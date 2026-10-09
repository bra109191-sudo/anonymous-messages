"use strict";

const SUPABASE_URL = "https://kgzvbmzxfkqasqouwfck.supabase.co/rest/v1/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnenZibXp4ZmtxYXNxb3V3ZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE2NjEsImV4cCI6MjEwNzExNzY2MX0.56Cr35qUjB-O3vIxoqq6PGrLyGgOGyIjbXXRrVljNcc";

const db = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const form = document.getElementById("messageForm");
const sendButton = document.getElementById("sendButton");
const statusBox = document.getElementById("status");

function showStatus(message, success) {
statusBox.style.display = "block";
statusBox.textContent = message;
statusBox.style.background = success
? "rgba(70, 190, 130, 0.15)"
: "rgba(230, 80, 100, 0.15)";
statusBox.style.color = success ? "#8be0b0" : "#ff9ca9";
}

form.addEventListener("submit", async function (event) {
event.preventDefault();

const sender = document.getElementById("sender").value.trim();
const recipient = document.getElementById("recipient").value.trim();
const message = document.getElementById("message").value.trim();

if (!sender || !recipient || !message) {
showStatus("يرجى تعبئة جميع الحقول.", false);
return;
}

if (
sender.length > 80 ||
recipient.length > 80 ||
message.length > 3000
) {
showStatus("تجاوز أحد الحقول الحد المسموح به.", false);
return;
}

sendButton.disabled = true;
sendButton.textContent = "جارٍ إرسال رسالتك...";
statusBox.style.display = "none";

try {
const { error } = await db
.from("messages")
.insert({
sender_name: sender,
recipient_name: recipient,
message_text: message
});

if (error) throw error;

form.reset();
showStatus("💌 تم إرسال رسالتك بنجاح!", true);

} catch (error) {
console.error("Message submission failed:", error);
showStatus(
"تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى لاحقًا.",
false
);

} finally {
sendButton.disabled = false;
sendButton.textContent = "💌 إرسال الرسالة";
}
});
