# SocialFlow AI setup

SocialFlow has two AI-assistance modes.

## 1. Local Assist — works immediately

No API key is required. The Composer and AI Studio can provide basic caption variations, rewrites, tone variations, hashtags, and post ideas using the built-in Local Assist fallback.

The UI labels these results **Local Assist** so they are not presented as OpenAI-generated content.

## 2. OpenAI — full generative AI

For higher-quality generative results:

1. Sign in to SocialFlow.
2. Open **Settings → AI Provider**.
3. Paste an OpenAI API key from the OpenAI developer platform.
4. Choose a model. GPT-5.6 Luna is the default cost-conscious option.
5. Click **Save AI settings**.
6. Click **Test OpenAI**.
7. Return to Composer or AI Studio.

The API key is encrypted before being stored in the workspace database and is never returned to the browser after saving.

## Failure behavior

If OpenAI is not configured, unavailable, rate-limited, or returns an empty response, normal Composer/AI Studio generation falls back to Local Assist and tells the user that it did so. The explicit **Test OpenAI** action does not hide OpenAI configuration errors.

A ChatGPT subscription is separate from OpenAI API usage/billing.
