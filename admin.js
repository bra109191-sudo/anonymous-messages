"use strict";

const SUPABASE_URL = "https://kgzvbmzxfkqasqouwfck.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnenZibXp4ZmtxYXNxb3V3ZmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDE2NjEsImV4cCI6MjEwNzExNzY2MX0.56Cr35qUjB-O3vIxoqq6PGrLyGgOGyIjbXXRrVljNcc";

// معرّف حساب المدير المسموح له بمشاهدة الرسائل وحذفها
const ADMIN_UID = "56871111-b511-41f2-86e3-e86d98ad9837";

const db = window.supabase.createClient(
SUPABASE_URL,
SUPABASE_KEY
);

// عناصر الصفحة
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

// عناصر التصميم الجديد
const notificationBell = document.getElementById("notificationBell");
const notificationBadge = document.getElementById("notificationBadge");
const totalMessagesElement = document.getElementById("totalMessages");
const newMessagesCountElement = document.getElementById("newMessagesCount");
const systemStatusElement = document.getElementById("systemStatus");
const notificationToast = document.getElementById("notificationToast");
const notificationToastText = document.getElementById("notificationToastText");

let allMessages = [];
let realtimeChannel = null;
let realtimeVersion = 0;
let toastTimer = null;

const STORAGE_KEY = `anonymous_messages_unread_${ADMIN_UID}`;

function getUnreadIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(saved.map(String));
  } catch {
    return new Set();
  }
}

let unreadIds = getUnreadIds();

function saveUnreadIds() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...unreadIds])
    );
  } catch (error) {
    console.error("Could not save unread messages:", error);
  }
}

function showStatus(element, message, success = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#8be0b0" : "#ff9ca9";
}

function clearStatus(element) {
  if (element) element.textContent = "";
}

function showLogin() {
  loginCard?.classList.remove("hidden");
  dashboard?.classList.add("hidden");
}

function showDashboard() {
  loginCard?.classList.add("hidden");
  dashboard?.classList.remove("hidden");
}

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;

  element.textContent = text ?? "";

  return element;
}

function showToast(message) {
  if (!notificationToast || !notificationToastText) return;

  notificationToastText.textContent = message;
  notificationToast.classList.remove("hidden");
  notificationToast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    notificationToast.classList.remove("show");
    notificationToast.classList.add("hidden");
  }, 5000);
}

function updateStatistics() {
  const unreadCount = unreadIds.size;

  if (totalMessagesElement) {
    totalMessagesElement.textContent = allMessages.length;
  }

  if (newMessagesCountElement) {
    newMessagesCountElement.textContent = unreadCount;
  }

  if (notificationBadge) {
    notificationBadge.textContent =
      unreadCount > 99 ? "99+" : String(unreadCount);

    notificationBadge.classList.toggle(
      "hidden",
      unreadCount === 0
    );

    notificationBadge.setAttribute(
      "aria-label",
      `${unreadCount} رسالة غير مقروءة`
    );
  }
}

function sortMessages() {
  allMessages.sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function markMessageAsRead(id) {
  unreadIds.delete(String(id));
  saveUnreadIds();
  updateStatistics();
  renderMessages();
}

function markAllAsRead() {
  unreadIds.clear();
  saveUnreadIds();
  updateStatistics();
  renderMessages();
}

function renderMessages() {
  if (!messagesList || !searchInput) return;

  const term = searchInput.value.trim().toLocaleLowerCase();

  const filtered = allMessages.filter((message) => {
    const searchableText = [
      message.sender_name,
      message.recipient_name,
      message.message_text
    ].join(" ").toLocaleLowerCase();

    return searchableText.includes(term);
  });

  if (messageCount) {
    messageCount.textContent =
      `عدد الرسائل: ${filtered.length}` +
      (filtered.length !== allMessages.length
        ? ` من أصل ${allMessages.length}`
        : "");
  }

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

    updateStatistics();
    return;
  }

  filtered.forEach((message) => {
    const card = document.createElement("article");
    card.className = "message";

    const isUnread = unreadIds.has(String(message.id));

    if (isUnread) {
      card.classList.add("unread-message");
    }

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
      `تاريخ الإرسال: ${
        message.created_at
          ? new Date(message.created_at).toLocaleString("ar", {
              dateStyle: "medium",
              timeStyle: "short"
            })
          : "غير محدد"
      }`
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

    const actions = document.createElement("div");
    actions.className = "message-actions";

    if (isUnread) {
      const unreadLabel = makeTextElement(
        "span",
        "count-pill",
        "جديدة"
      );

      const readButton = makeTextElement(
        "button",
        "tool-button",
        "تعليم كمقروءة"
      );

      readButton.type = "button";

      readButton.addEventListener("click", () => {
        markMessageAsRead(message.id);
      });

      actions.append(unreadLabel, readButton);
    } else {
      actions.appendChild(
        makeTextElement("span", "meta", "تمت قراءتها")
      );
    }

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

        unreadIds.delete(String(message.id));
        saveUnreadIds();

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
      actions,
      deleteButton
    );

    messagesList.appendChild(card);
  });

  updateStatistics();
}

async function loadMessages() {
  if (!refreshButton) return;

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

    const latestById = new Map(
      (data || []).map((message) => [
        String(message.id),
        message
      ])
    );

    if (currentVersion === realtimeVersion) {
      allMessages = Array.from(latestById.values());
    } else {
      const existingById = new Map(
        allMessages.map((message) => [
          String(message.id),
          message
        ])
      );

      for (const message of data || []) {
        if (!existingById.has(String(message.id))) {
          existingById.set(String(message.id), message);
        }
      }

      allMessages = Array.from(existingById.values());
    }

    // إزالة إشعارات الرسائل التي لم تعد موجودة
    const existingIds = new Set(
      allMessages.map((message) => String(message.id))
    );

    unreadIds = new Set(
      [...unreadIds].filter((id) => existingIds.has(id))
    );

    saveUnreadIds();
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

  const id = String(message.id);

  const existingIndex = allMessages.findIndex(
    (item) => String(item.id) === id
  );

  // لا نكرر التنبيه إذا وصل الحدث نفسه أكثر من مرة
  const isActuallyNew = existingIndex === -1;

  if (existingIndex !== -1) {
    allMessages[existingIndex] = message;
  } else {
    allMessages.push(message);
  }

  if (isActuallyNew) {
    unreadIds.add(id);
    saveUnreadIds();

    showToast("📩 وصلت رسالة جديدة!");

    showStatus(
      dashboardStatus,
      "وصلت رسالة جديدة وتم تحديث القائمة تلقائيًا.",
      true
    );
  }

  sortMessages();
  renderMessages();
}

function handleRealtimeDelete(message) {
  if (!message || message.id == null) return;

  realtimeVersion++;

  const id = String(message.id);

  allMessages = allMessages.filter(
    (item) => String(item.id) !== id
  );

  unreadIds.delete(id);
  saveUnreadIds();

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
        if (systemStatusElement) {
          systemStatusElement.textContent = "متصل";
          systemStatusElement.classList.add("online");
        }

        showStatus(
          dashboardStatus,
          "🟢 التحديث الفوري متصل. ستظهر الرسائل الجديدة تلقائيًا.",
          true
        );
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        if (systemStatusElement) {
          systemStatusElement.textContent = "غير متصل";
          systemStatusElement.classList.remove("online");
        }

        showStatus(
          dashboardStatus,
          "تعذر الاتصال بالتحديث الفوري. تحقق من إعدادات Realtime في Supabase."
        );
      } else if (status === "CLOSED") {
        if (systemStatusElement) {
          systemStatusElement.textContent = "منقطع";
          systemStatusElement.classList.remove("online");
        }
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

// الضغط على الجرس يعلّم الإشعارات الحالية كمقروءة
if (notificationBell) {
  notificationBell.addEventListener("click", () => {
    markAllAsRead();

    messagesList?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

updateStatistics();
checkSession();
