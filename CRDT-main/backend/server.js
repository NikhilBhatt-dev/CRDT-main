import express from 'express'
import { Server } from 'socket.io'
import { createServer } from 'http'
import {YSocketIO} from "y-socket.io/dist/server"
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".env")
if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile !== "function") {
        throw new Error("Loading backend/.env requires Node.js 20.6 or newer.")
    }
    process.loadEnvFile(envPath)
}



const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDistPath = path.resolve(__dirname, "../frontend/vite-project/dist")
const publicPath = path.resolve(__dirname, "public")
const indexHtmlPath = fs.existsSync(path.join(publicPath, "index.html"))
    ? path.join(publicPath, "index.html")
    : path.join(frontendDistPath, "index.html")
const PORT = process.env.PORT || 3000
const ONLINECOMPILER_API_URL =
    process.env.ONLINECOMPILER_API_URL || "https://api.onlinecompiler.io/api/run-code-sync/"
const MAX_SOURCE_BYTES = 100_000
const MAX_STDIN_BYTES = 100_000
const EXECUTION_TIMEOUT_MS = 35_000

const supportedLanguages = [
    { key: "java", label: "Java", compiler: "openjdk-25", monacoLanguage: "java" },
    { key: "cpp", label: "C++", compiler: "g++-15", monacoLanguage: "cpp" },
    { key: "python", label: "Python", compiler: "python-3.14", monacoLanguage: "python" },
    { key: "javascript", label: "JavaScript (Node.js)", compiler: "nodejs-24", monacoLanguage: "javascript" },
]

const executionRateLimits = new Map()

class OnlineCompilerError extends Error {
    constructor(message, status) {
        super(message)
        this.status = status
    }
}

function getOnlineCompilerUrl() {
    if (!process.env.ONLINECOMPILER_API_KEY) {
        throw new OnlineCompilerError("Code execution is not configured on the server.", 503)
    }

    try {
        const apiUrl = new URL(ONLINECOMPILER_API_URL)
        if (
            apiUrl.protocol !== "https:" ||
            apiUrl.hostname !== "api.onlinecompiler.io" ||
            apiUrl.pathname !== "/api/run-code-sync/" ||
            apiUrl.search ||
            apiUrl.hash ||
            apiUrl.username ||
            apiUrl.password
        ) {
            throw new Error("Invalid OnlineCompiler URL")
        }
        return apiUrl
    } catch {
        throw new OnlineCompilerError("The configured OnlineCompiler API URL is invalid.", 500)
    }
}

async function runOnOnlineCompiler(payload) {
    const apiUrl = getOnlineCompilerUrl()
    const apiKey = process.env.ONLINECOMPILER_API_KEY
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS)

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        })

        let result
        try {
            result = await response.json()
        } catch {
            result = null
        }

        if (!response.ok) {
            if (response.status === 429) {
                throw new OnlineCompilerError("OnlineCompiler is busy or its request limit was reached.", 429)
            }
            if (response.status === 401 || response.status === 403) {
                throw new OnlineCompilerError("OnlineCompiler rejected the backend credentials.", 502)
            }
            throw new OnlineCompilerError(
                `OnlineCompiler returned HTTP ${response.status}.`,
                502
            )
        }

        if (
            !result ||
            typeof result !== "object" ||
            typeof result.output !== "string" ||
            (result.error !== null && typeof result.error !== "string") ||
            (result.status !== "success" && result.status !== "error") ||
            (result.exit_code !== null && !Number.isInteger(result.exit_code))
        ) {
            throw new OnlineCompilerError("OnlineCompiler returned an invalid execution result.", 502)
        }

        return {
            output: result.output,
            error: result.error || "",
            status: result.status,
            exitCode: result.exit_code,
            signal: result.signal ?? null,
            truncated: result.truncated === true,
            time: typeof result.time === "number" ? result.time : null,
            total: typeof result.total === "number" ? result.total : null,
            memory: typeof result.memory === "number" ? result.memory : null,
        }
    } catch (error) {
        if (error instanceof OnlineCompilerError) throw error
        if (error.name === "AbortError") {
            throw new OnlineCompilerError("The OnlineCompiler request timed out.", 504)
        }
        throw new OnlineCompilerError("Could not connect to OnlineCompiler.", 502)
    } finally {
        clearTimeout(timeout)
    }
}

function limitExecutionRequests(req, res, next) {
    const now = Date.now()
    const key = req.ip
    const record = executionRateLimits.get(key)
    const windowMs = 60_000
    const maxRequests = 10

    if (!record || record.resetAt <= now) {
        executionRateLimits.set(key, { count: 1, resetAt: now + windowMs })
    } else if (record.count >= maxRequests) {
        res.set("Retry-After", Math.ceil((record.resetAt - now) / 1_000))
        return res.status(429).json({ error: "Too many execution requests. Try again shortly." })
    } else {
        record.count += 1
    }

    if (executionRateLimits.size > 1_000) {
        for (const [ip, limit] of executionRateLimits) {
            if (limit.resetAt <= now) executionRateLimits.delete(ip)
        }
    }
    next()
}

function hasNulCharacter(value) {
    return value.includes("\0")
}

function findSupportedLanguage(key) {
    return supportedLanguages.find((language) => language.key === key)
}

async function executeCode(req, res) {
    const body = req.body
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ error: "A JSON request body is required." })
    }

    const { sourceCode, language, stdin = "" } = body
    if (typeof language !== "string" || !findSupportedLanguage(language)) {
        return res.status(400).json({ error: "language must be java, cpp, python, or javascript." })
    }
    if (typeof sourceCode !== "string" || !sourceCode.trim()) {
        return res.status(400).json({ error: "sourceCode must be a non-empty string." })
    }
    if (Buffer.byteLength(sourceCode, "utf8") > MAX_SOURCE_BYTES) {
        return res.status(413).json({ error: "Source code must be 100 KB or smaller." })
    }
    if (hasNulCharacter(sourceCode)) {
        return res.status(400).json({ error: "Source code must not contain NUL characters." })
    }
    if (typeof stdin !== "string") {
        return res.status(400).json({ error: "stdin must be a string." })
    }
    if (Buffer.byteLength(stdin, "utf8") > MAX_STDIN_BYTES) {
        return res.status(413).json({ error: "Standard input must be 100 KB or smaller." })
    }
    if (hasNulCharacter(stdin)) {
        return res.status(400).json({ error: "Standard input must not contain NUL characters." })
    }

    try {
        const selectedLanguage = findSupportedLanguage(language)
        const result = await runOnOnlineCompiler({
            compiler: selectedLanguage.compiler,
            code: sourceCode,
            input: stdin,
            time_limit: 25,
        })
        res.json(result)
    } catch (error) {
        console.error("OnlineCompiler execution failed:", error.message)
        res.status(error.status || 502).json({ error: error.message })
    }
}

// app.use(express.static(frontendDistPath))
app.use(express.static("public"))
app.use("/api", (req, res, next) => {
    const origin = req.get("Origin")
    if (origin && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) {
        res.set("Access-Control-Allow-Origin", origin)
        res.vary("Origin")
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        res.set("Access-Control-Allow-Headers", "Content-Type")
        if (req.method === "OPTIONS") return res.sendStatus(204)
    }
    next()
})
app.use("/api", express.json({ limit: "256kb" }))
const httpServer = createServer(app)


const io =  new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})



const ySocketIO = new YSocketIO(io)
ySocketIO.initialize()





app.get('/health', (req,res) => {
    res.status(200).json({
        message:"ok",
        success:true
    })
})

app.post("/api/execute", limitExecutionRequests, executeCode)

app.use((error, req, res, next) => {
    if (req.path.startsWith("/api/")) {
        if (error.type === "entity.too.large") {
            return res.status(413).json({ error: "Request body must be 256 KB or smaller." })
        }
        if (error instanceof SyntaxError && error.status === 400) {
            return res.status(400).json({ error: "Request body must contain valid JSON." })
        }
    }
    next(error)
})

app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found." })
})

app.use((req, res) => {
    res.sendFile(indexHtmlPath)
})


httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`server is running on port ${PORT}`)
})
