"""Twilio SMS alerting module (last-mile notification)."""
import os
import requests

def configured():
    return bool(os.getenv("TWILIO_ACCOUNT_SID")) and bool(os.getenv("TWILIO_AUTH_TOKEN")) and bool(os.getenv("ALERT_TO_NUMBERS"))

def format_hazard_alert(district, state, hazard_type, max_severity, detail):
    return f"MEGHDRISHTI ALERT: {max_severity.upper()} {hazard_type} hazard detected near {district}, {state}. {detail}"

def send_sms(body):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    to_numbers = os.getenv("ALERT_TO_NUMBERS", "").split(",")

    if not configured():
        return []

    sent = []
    for number in to_numbers:
        number = number.strip()
        if not number:
            continue
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        data = {
            "From": from_number,
            "To": number,
            "Body": body
        }
        resp = requests.post(url, data=data, auth=(account_sid, auth_token), timeout=10)
        resp.raise_for_status()
        sent.append(number)
    return sent
