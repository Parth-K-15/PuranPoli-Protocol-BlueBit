const express = require("express");

const router = express.Router();

router.post("/run", async (req, res, next) => {
  try {
    const { targetUrl, payload } = req.body || {};

    if (!targetUrl || typeof targetUrl !== "string") {
      return res.status(400).json({
        success: false,
        error: "targetUrl is required",
      });
    }

    const headers = {
      "Content-Type": "application/json",
    };

    // Required by ngrok browser warning middleware on some free tunnels.
    if (targetUrl.includes("ngrok-free.dev") || targetUrl.includes("ngrok.io")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
    });

    const rawText = await response.text();
    let parsedBody = rawText;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      // Keep raw text when downstream response is not JSON.
    }

    return res.status(response.status).json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: parsedBody,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
