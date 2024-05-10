const tailwindIcon = document.getElementById("tailwind-icon");
const fallbackIcon = document.getElementById("fallback-icon");
const messageElement = document.getElementById("message");

const updateUI = (hasTailwindCSS, tailwindVersion) => {
  if (messageElement) {
    messageElement.textContent = hasTailwindCSS
      ? tailwindVersion === "unknown"
        ? "Has Tailwind CSS"
        : `Has Tailwind CSS v${tailwindVersion}`
      : "No Tailwind CSS";
  }

  if (hasTailwindCSS) {
    tailwindIcon.style.display = "block";
    fallbackIcon.style.display = "none";
  } else {
    tailwindIcon.style.display = "none";
    fallbackIcon.style.display = "block";
  }
};

// Request Tailwind CSS status from the background script
chrome.runtime.sendMessage({ requestUpdate: true }, (response) => {
  updateUI(response.hasTailwindCSS, response.tailwindVersion);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in popup script:", message);

  if (typeof message.hasTailwindCSS !== "undefined") {
    updateUI(message.hasTailwindCSS, message.tailwindVersion);
    sendResponse({ message: "Popup received the message" });
  } else {
    console.log("Invalid message received");
  }

  return true; // Ensure the sendResponse is maintained
});
