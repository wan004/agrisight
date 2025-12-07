import requests
import json
import subprocess
import time

# -----------------------------
# CONFIG
# -----------------------------
BOT_TOKEN = "8185263983:AAGXQvTg8evpEu1TagnCO9ngYURNeM_kNVA"
LOCAL_PORT = 5000                     # Your Flask port
WEBHOOK_PATH = "/telegram/webhook"    # Your webhook route


# -----------------------------
# GET CURRENT NGROK URL
# -----------------------------
def get_ngrok_url():
    try:
        # ngrok API (works for ngrok v3)
        resp = requests.get("http://127.0.0.1:4040/api/tunnels").json()
        for tunnel in resp["tunnels"]:
            if tunnel["public_url"].startswith("https"):
                return tunnel["public_url"]
    except:
        return None


# -----------------------------
# SET WEBHOOK
# -----------------------------
def set_webhook():
    ngrok_url = get_ngrok_url()
    if not ngrok_url:
        print("❌ No ngrok tunnel found. Run: ngrok http 5000")
        return

    full_url = ngrok_url + WEBHOOK_PATH
    api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook"

    payload = {"url": full_url}
    r = requests.post(api_url, json=payload)

    print("Webhook set to:", full_url)
    print("Telegram response:", r.json())


# -----------------------------
# DELETE WEBHOOK
# -----------------------------
def delete_webhook():
    api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook"
    r = requests.get(api_url)
    print("Webhook deleted:", r.json())


# -----------------------------
# CHECK WEBHOOK STATUS
# -----------------------------
def info():
    api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo"
    r = requests.get(api_url)
    print(json.dumps(r.json(), indent=4))


# -----------------------------
# MAIN MENU
# -----------------------------
def menu():
    print("\n===============================")
    print("   TELEGRAM WEBHOOK MANAGER")
    print("===============================")
    print("1. Set webhook (auto-ngrok)")
    print("2. Delete webhook")
    print("3. Webhook info")
    print("4. Quit")

    choice = input("\nChoose: ").strip()

    if choice == "1":
        set_webhook()
    elif choice == "2":
        delete_webhook()
    elif choice == "3":
        info()
    else:
        print("Exiting...")


if __name__ == "__main__":
    menu()
