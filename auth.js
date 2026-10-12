
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");

function requireLogin(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({
            error: "Authentication required"
        });
    }

    next();
}

function requireSameOrigin(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }

    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");

    // Browsers identify cross-site requests here.
    if (fetchSite === "cross-site") {
        return res.status(403).json({
            error: "Cross-site request blocked"
        });
    }

    // Require a valid Origin header for browser API writes.
    if (!origin) {
        return res.status(403).json({
            error: "Request origin required"
        });
    }

    let parsedOrigin;

    try {
        parsedOrigin = new URL(origin);
    } catch {
        return res.status(403).json({
            error: "Invalid request origin"
        });
    }

    const expectedHost = req.get("host");

    if (
        !["http:", "https:"].includes(parsedOrigin.protocol) ||
        parsedOrigin.host !== expectedHost ||
        parsedOrigin.origin !== origin
    ) {
        return res.status(403).json({
            error: "Request origin not allowed"
        });
    }

    // On the public domain, require HTTPS.
    if (
        expectedHost !== "localhost:3100" &&
        parsedOrigin.protocol !== "https:"
    ) {
        return res.status(403).json({
            error: "HTTPS required"
        });
    }

    next();
}

function configureAuthentication(app) {
    if (
        !process.env.SESSION_SECRET ||
        !process.env.ADMIN_PASSWORD_HASH ||
        !process.env.MONGODB_URI
    ) {
        throw new Error(
            "Authentication configuration is incomplete"
        );
    }

    app.set("trust proxy", 1);

    app.use(session({
        name: "mcr.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            collectionName: "sessions",
            ttl: 60 * 60 * 12
        }),
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 12 * 60 * 60 * 1000
        }
    }));

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: {
            error: "Too many login attempts. Try again in 15 minutes."
        }
    });

    app.post(
        "/auth/login",
        loginLimiter,
        requireSameOrigin,
        async (req, res) => {
            const password = req.body?.password;

            if (
                typeof password !== "string" ||
                password.length > 1024
            ) {
                return res.status(400).json({
                    error: "Invalid login request"
                });
            }

            try {
                const valid = await bcrypt.compare(
                    password,
                    process.env.ADMIN_PASSWORD_HASH
                );

                if (!valid) {
                    return res.status(401).json({
                        error: "Invalid credentials"
                    });
                }

                req.session.regenerate(error => {
                    if (error) {
                        return res.status(500).json({
                            error: "Unable to create session"
                        });
                    }

                    req.session.user = {
                        businessId: "keycontrol",
                        role: "admin"
                    };

                    req.session.save(error => {
                        if (error) {
                            return res.status(500).json({
                                error: "Unable to save session"
                            });
                        }

                        res.json({ success: true });
                    });
                });
            } catch (error) {
                console.error("[LOGIN ERROR]", error.message);

                res.status(500).json({
                    error: "Authentication failed"
                });
            }
        }
    );

    app.post(
        "/auth/logout",
        requireSameOrigin,
        (req, res) => {
            req.session.destroy(error => {
                if (error) {
                    return res.status(500).json({
                        error: "Unable to log out"
                    });
                }

                res.clearCookie("mcr.sid");
                res.json({ success: true });
            });
        }
    );

    app.get("/auth/me", requireLogin, (req, res) => {
        res.json({ user: req.session.user });
    });
}

module.exports = {
    configureAuthentication,
    requireLogin,
    requireSameOrigin
};
