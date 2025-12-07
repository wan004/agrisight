import requests
from config import Config

BASE = f"https://api.telegram.org/bot{Config.TELEGRAM_TOKEN}"


# ---------------------------------------------------------
# SEND TEXT MESSAGE (Supports Markdown, HTML, Plain Text)
# ---------------------------------------------------------
def tg_send(text, parse_mode=None):
    """
    Send a Telegram message.
    parse_mode can be: "Markdown", "MarkdownV2", "HTML", or None.
    Example: tg_send("**Hello**", parse_mode="Markdown")
    """
    try:
        payload = {
            "chat_id": Config.TELEGRAM_CHAT_ID,
            "text": text
        }

        if parse_mode:
            payload["parse_mode"] = parse_mode

        requests.post(
            f"{BASE}/sendMessage",
            json=payload,
            timeout=4
        )
    except Exception as e:
        print("[Telegram] sendMessage failed:", e)


# ---------------------------------------------------------
# SEND PHOTO (Supports caption parse_mode)
# ---------------------------------------------------------
def tg_send_photo(path, caption="AgriSight Update", parse_mode=None):
    """
    Send a photo with optional caption + formatting.
    Example: tg_send_photo(path, "🌿 *Scan Done*", parse_mode="Markdown")
    """
    try:
        with open(path, "rb") as img:
            data = {
                "chat_id": Config.TELEGRAM_CHAT_ID,
                "caption": caption
            }

            if parse_mode:
                data["parse_mode"] = parse_mode

            requests.post(
                f"{BASE}/sendPhoto",
                data=data,
                files={"photo": img},
                timeout=8
            )
    except Exception as e:
        print("[Telegram] sendPhoto failed:", e)
