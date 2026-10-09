"use strict";

const SUPABASE_URL = "https://kgzvbmzxfkqasqouwfck.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnenZibXp4ZmtxYXNxb3V3ZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE2NjEsImV4cCI6MjEwNzExNzY2MX0.56Cr35qUjB-O3vIxoqq6PGrLyGgOGyIjbXXRrVljNcc";

// معرّف حساب المدير المسموح له بمشاهدة الرسائل وحذفها
const ADMIN_UID = "56871111-b511-41f2-86e3-e86d98ad9837";

const db = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");

const dashboard = document.getElementById("dashboard");
const dashboardStatus = document.getElementById("dashboardStatus");
const messagesList = document.getElementById("messagesList");
const messageCount = document.getElementById("messageCount");
const searchInput = document.getElementById("searchInput");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

let allMessages = [];
let realtimeChannel = null;
let realtimeVersion = 0;

function showStatus(element, message, success = false) {
  element.textContent = message;
  element.style.color = success ? "#8be0b0" : "#ff9ca9";
}

function clearStatus(element) {
  element.textContent = "";
}

function showLogin() {
  loginCard.classList.remove("hidden");
  dashboard.classList.add("hidden");
}

function showDashboard() {
  loginCard.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  element.textContent = text ?? "";

  return element;
}

function sortMessages() {
  allMessages.sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderMessages() {
  const term = searchInput.value.trim().toLocaleLowerCase();

  const filtered = allMessages.filter((message) => {
    const searchableText = [
      message.sender_name,
      message.recipient_name,
      message.message_text
    ].join(" ").toLocaleLowerCase();

    return searchableText.includes(term);
  });

  messageCount.textContent =
    `عدد الرسائل: ${filtered.length}` +
    (filtered.length !== allMessages.length
      ? ` من أصل ${allMessages.length}`
      : "");

  messagesList.replaceChildren();

  if (filtered.length === 0) {
    messagesList.appendChild(
      makeTextElement(
        "div",
        "empty",
        allMessages.length === 0
          ? "لا توجد رسائل حتى الآن."
          : "لا توجد نتائج مطابقة للبحث."
      )
    );

    return;
  }

  filtered.forEach((message) => {
    const card = document.createElement("article");
    card.className = "message";

    const sender = makeTextElement(
      "div",
      "meta",
      `اسم المرسل: ${message.sender_name || "غير محدد"}`
    );

    const recipient = makeTextElement(
      "div",
      "meta",
      `اسم المستلم: ${message.recipient_name || "غير محدد"}`
    );

    const date = makeTextElement(
      "div",
      "meta",
      `تاريخ الإرسال: ${message.created_at
        ? new Date(message.created_at).toLocaleString("ar", {
            dateStyle: "medium",
            timeStyle: "short"
          })
        : "غير محدد"}`
    );

    const messageHeading = makeTextElement(
      "strong",
      "",
      "نص الرسالة"
    );

    const messageText = makeTextElement(
      "p",
      "message-text",
      message.message_text || ""
    );

    const deleteButton = makeTextElement(
      "button",
      "danger",
      "حذف الرسالة"
    );

    deleteButton.type = "button";

    deleteButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "هل أنت متأكد أنك تريد حذف هذه الرسالة نهائيًا؟"
      );

      if (!confirmed) return;

      deleteButton.disabled = true;
      deleteButton.textContent = "جارٍ الحذف...";

      try {
        const { data, error } = await db
          .from("messages")
          .delete()
          .eq("id", message.id)
          .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error(
            "لم يتم حذف الرسالة. تحقق من صلاحيات المدير."
          );
        }

        allMessages = allMessages.filter(
          (item) => item.id !== message.id
        );

        renderMessages();

        showStatus(
          dashboardStatus,
          "تم حذف الرسالة بنجاح.",
          true
        );

      } catch (error) {
        console.error("Delete failed:", error);

        showStatus(
          dashboardStatus,
          "تعذر حذف الرسالة. تحقق من تسجيل الدخول وصلاحيات الحساب."
        );

        deleteButton.disabled = false;
        deleteButton.textContent = "حذف الرسالة";
      }
    });

    card.append(
      sender,
      recipient,
      date,
      messageHeading,
      messageText,
      deleteButton
    );

    messagesList.appendChild(card);
  });
}

async function loadMessages() {
  const currentVersion = realtimeVersion;

  refreshButton.disabled = true;
  refreshButton.textContent = "جارٍ التحديث...";

  try {
    const { data, error } = await db
      .from("messages")
      .select(
        "id, sender_name, recipient_name, message_text, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // دمج نتيجة التحميل مع أي تغييرات وصلت أثناء التحميل
    const latestById = new Map(
      (data || []).map((message) => [message.id, message])
    );

    // لا نستبدل التغييرات الفورية الأحدث بنتيجة تحميل قديمة
    if (currentVersion === realtimeVersion) {
      allMessages = Array.from(latestById.values());
    } else {
      const existingById = new Map(
        allMessages.map((message) => [message.id, message])
      );

      for (const message of data || []) {
        if (!existingById.has(message.id)) {
          existingById.set(message.id, message);
        }
      }

      allMessages = Array.from(existingById.values());
    }

    sortMessages();
    renderMessages();

    showStatus(
      dashboardStatus,
      "تم تحميل الرسائل بنجاح.",
      true
    );

  } catch (error) {
    console.error("Loading messages failed:", error);

    showStatus(
      dashboardStatus,
      "تعذر تحميل الرسائل. تحقق من إعدادات Supabase وصلاحيات المدير."
    );

  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "تحديث الرسائل";
  }
}

function handleRealtimeInsert(message) {
  if (!message || message.id == null) return;

  realtimeVersion++;

  const existingIndex = allMessages.findIndex(
    (item) => item.id === message.id
  );

  if (existingIndex !== -1) {
    allMessages[existingIndex] = message;
  } else {
    allMessages.push(message);
  }

  sortMessages();
  renderMessages();

  showStatus(
    dashboardStatus,
    "📩 وصلت رسالة جديدة وتم تحديث القائمة تلقائيًا.",
    true
  );
}

function handleRealtimeDelete(message) {
  if (!message || message.id == null) return;

  realtimeVersion++;

  allMessages = allMessages.filter(
    (item) => item.id !== message.id
  );

  renderMessages();

  showStatus(
    dashboardStatus,
    "تم حذف الرسالة وتحديث القائمة تلقائيًا.",
    true
  );
}

async function stopRealtimeSubscription() {
  const oldChannel = realtimeChannel;

  realtimeChannel = null;

  if (oldChannel) {
    try {
      await db.removeChannel(oldChannel);
    } catch (error) {
      console.error("Realtime unsubscribe failed:", error);
    }
  }
}

async function startRealtimeSubscription() {
  await stopRealtimeSubscription();

  const channel = db
    .channel("admin-messages-live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      (payload) => {
        handleRealtimeInsert(payload.new);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages"
      },
      (payload) => {
        handleRealtimeDelete(payload.old);
      }
    )
    .subscribe((status) => {
      if (realtimeChannel !== channel) return;

      if (status === "SUBSCRIBED") {
        showStatus(
          dashboardStatus,
          "🟢 التحديث الفوري متصل. ستظهر الرسائل الجديدة تلقائيًا.",
          true
        );
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        showStatus(
          dashboardStatus,
          "⚠️ تعذر الاتصال بالتحديث الفوري. تحقق من تفعيل Realtime في Supabase."
        );
      } else if (status === "CLOSED") {
        showStatus(
          dashboardStatus,
          "انقطع اتصال التحديث الفوري. قد تحتاج إلى إعادة فتح الصفحة."
        );
      }
    });

  realtimeChannel = channel;
}

async function checkSession() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    const session = data.session;

    if (!session) {
      showLogin();
      return;
    }

    if (session.user.id !== ADMIN_UID) {
      await db.auth.signOut();

      showLogin();

      showStatus(
        loginStatus,
        "هذا الحساب غير مخوّل لدخول لوحة الإدارة."
      );

      return;
    }

    showDashboard();

    // نبدأ الاشتراك أولًا حتى لا تفوتنا رسالة جديدة أثناء التحميل
    await startRealtimeSubscription();
    await loadMessages();

  } catch (error) {
    console.error("Session check failed:", error);

    showLogin();

    showStatus(
      loginStatus,
      "تعذر التحقق من تسجيل الدخول. أعد تحميل الصفحة."
    );
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginButton.disabled = true;
  loginButton.textContent = "جارٍ تسجيل الدخول...";

  clearStatus(loginStatus);

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (!data.user || data.user.id !== ADMIN_UID) {
      await db.auth.signOut();

      throw new Error(
        "هذا الحساب غير مخوّل لدخول لوحة الإدارة."
      );
    }

    loginForm.reset();
    showDashboard();

    await startRealtimeSubscription();
    await loadMessages();

  } catch (error) {
    console.error("Login failed:", error);

    showStatus(
      loginStatus,
      error.message ===
        "هذا الحساب غير مخوّل لدخول لوحة الإدارة."
        ? error.message
        : "فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور."
    );

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "تسجيل الدخول";
  }
});

refreshButton.addEventListener("click", loadMessages);

searchInput.addEventListener("input", renderMessages);

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await stopRealtimeSubscription();

    const { error } = await db.auth.signOut();

    if (error) throw error;

    allMessages = [];
    messagesList.replaceChildren();
    searchInput.value = "";

    showLogin();
    clearStatus(loginStatus);
    clearStatus(dashboardStatus);

  } catch (error) {
    console.error("Logout failed:", error);

    showStatus(
      dashboardStatus,
      "تعذر تسجيل الخروج. حاول مرة أخرى."
    );

  } finally {
    logoutButton.disabled = false;
  }
});

checkSession();
