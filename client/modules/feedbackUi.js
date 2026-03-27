import { state, hooks } from "./store.js";

const BUG_QUESTIONS = {
  firstLabel: "What happened?",
  firstPlaceholder: "Describe the bug or broken behavior you ran into.",
  secondLabel: "What did you expect?",
  secondPlaceholder: "Tell us what you thought should happen instead.",
  thirdLabel: "What were you doing right before it happened?",
  thirdPlaceholder: "Share the steps, clicks, or context leading up to it.",
  successTitle: "Bug report sent",
  successBody:
    "Thanks for the report. We saved the context with it so we can review it with context.",
};

const FEATURE_QUESTIONS = {
  firstLabel: "What are you trying to do?",
  firstPlaceholder: "Describe the goal or workflow you want help with.",
  secondLabel: "What is hard today?",
  secondPlaceholder: "Explain where the current app gets in your way.",
  thirdLabel: "What would make this better?",
  thirdPlaceholder:
    "Share the change, shortcut, or capability you wish existed.",
  successTitle: "Feature request sent",
  successBody:
    "Thanks for the idea. We saved it with your app context so it is ready for review.",
};

function getQuestionCopy(type) {
  return type === "feature" ? FEATURE_QUESTIONS : BUG_QUESTIONS;
}

function getFeedbackElements() {
  return {
    form: document.getElementById("feedbackForm"),
    type: document.getElementById("feedbackType"),
    title: document.getElementById("feedbackTitle"),
    screenshotUrl: document.getElementById("feedbackScreenshotUrl"),
    attachment: document.getElementById("feedbackAttachment"),
    attachmentSummary: document.getElementById("feedbackAttachmentSummary"),
    firstLabel: document.getElementById("feedbackQuestionOneLabel"),
    firstField: document.getElementById("feedbackQuestionOne"),
    secondLabel: document.getElementById("feedbackQuestionTwoLabel"),
    secondField: document.getElementById("feedbackQuestionTwo"),
    thirdLabel: document.getElementById("feedbackQuestionThreeLabel"),
    thirdField: document.getElementById("feedbackQuestionThree"),
    message: document.getElementById("feedbackMessage"),
    confirmation: document.getElementById("feedbackConfirmation"),
    confirmationTitle: document.getElementById("feedbackConfirmationTitle"),
    confirmationBody: document.getElementById("feedbackConfirmationBody"),
    confirmationMeta: document.getElementById("feedbackConfirmationMeta"),
    currentPage: document.getElementById("feedbackContextPage"),
    appVersion: document.getElementById("feedbackContextVersion"),
    userValue: document.getElementById("feedbackContextUser"),
  };
}

function getSelectedType() {
  const { type } = getFeedbackElements();
  if (!(type instanceof HTMLSelectElement)) {
    return "bug";
  }
  return type.value === "feature" ? "feature" : "bug";
}

function readAppVersion() {
  const fromMeta = document
    .querySelector('meta[name="app-version"]')
    ?.getAttribute("content");
  return fromMeta?.trim() || "unknown";
}

function getAttachmentMetadata() {
  const { attachment } = getFeedbackElements();
  if (!(attachment instanceof HTMLInputElement) || !attachment.files?.length) {
    return null;
  }

  const file = attachment.files[0];
  return {
    name: file.name || null,
    type: file.type || null,
    size: Number.isFinite(file.size) ? file.size : null,
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
  };
}

function buildFeedbackBody(type) {
  const { firstField, secondField, thirdField } = getFeedbackElements();
  const first =
    firstField instanceof HTMLTextAreaElement ? firstField.value : "";
  const second =
    secondField instanceof HTMLTextAreaElement ? secondField.value : "";
  const third =
    thirdField instanceof HTMLTextAreaElement ? thirdField.value : "";

  const sections =
    type === "feature"
      ? [
          ["What are you trying to do?", first],
          ["What is hard today?", second],
          ["What would make this better?", third],
        ]
      : [
          ["What happened?", first],
          ["What did you expect?", second],
          ["What were you doing right before it happened?", third],
        ];

  return sections
    .map(([label, value]) => `${label}\n${String(value || "").trim()}`)
    .join("\n\n")
    .trim();
}

function syncContextPreview() {
  const { currentPage, appVersion, userValue } = getFeedbackElements();
  if (currentPage instanceof HTMLElement) {
    currentPage.textContent = window.location.href;
  }
  if (appVersion instanceof HTMLElement) {
    appVersion.textContent = readAppVersion();
  }
  if (userValue instanceof HTMLElement) {
    userValue.textContent = state.currentUser?.id || "Signed out";
  }
}

export function syncFeedbackFormCopy() {
  const {
    type,
    firstLabel,
    firstField,
    secondLabel,
    secondField,
    thirdLabel,
    thirdField,
  } = getFeedbackElements();

  const feedbackType =
    type instanceof HTMLSelectElement && type.value === "feature"
      ? "feature"
      : "bug";
  const copy = getQuestionCopy(feedbackType);

  if (firstLabel instanceof HTMLElement) {
    firstLabel.textContent = copy.firstLabel;
  }
  if (firstField instanceof HTMLTextAreaElement) {
    firstField.placeholder = copy.firstPlaceholder;
  }
  if (secondLabel instanceof HTMLElement) {
    secondLabel.textContent = copy.secondLabel;
  }
  if (secondField instanceof HTMLTextAreaElement) {
    secondField.placeholder = copy.secondPlaceholder;
  }
  if (thirdLabel instanceof HTMLElement) {
    thirdLabel.textContent = copy.thirdLabel;
  }
  if (thirdField instanceof HTMLTextAreaElement) {
    thirdField.placeholder = copy.thirdPlaceholder;
  }

  syncContextPreview();
}

export function handleFeedbackTypeChange() {
  syncFeedbackFormCopy();
}

export function handleFeedbackAttachmentChange() {
  const { attachmentSummary } = getFeedbackElements();
  if (!(attachmentSummary instanceof HTMLElement)) {
    return;
  }

  const metadata = getAttachmentMetadata();
  if (!metadata) {
    attachmentSummary.textContent = "No screenshot file selected.";
    return;
  }

  attachmentSummary.textContent = `${metadata.name || "Attachment"} (${metadata.type || "unknown type"}, ${metadata.size ?? 0} bytes)`;
}

function showConfirmation(type, requestId) {
  const {
    form,
    confirmation,
    confirmationTitle,
    confirmationBody,
    confirmationMeta,
  } = getFeedbackElements();
  const copy = getQuestionCopy(type);

  if (form instanceof HTMLFormElement) {
    form.hidden = true;
  }
  if (confirmation instanceof HTMLElement) {
    confirmation.hidden = false;
  }
  if (confirmationTitle instanceof HTMLElement) {
    confirmationTitle.textContent = copy.successTitle;
  }
  if (confirmationBody instanceof HTMLElement) {
    confirmationBody.textContent = copy.successBody;
  }
  if (confirmationMeta instanceof HTMLElement) {
    confirmationMeta.textContent = requestId
      ? `Reference ID: ${requestId}`
      : "Your feedback has been saved.";
  }
}

export function resetFeedbackFormView() {
  const { form, confirmation, attachmentSummary, message, type } =
    getFeedbackElements();

  if (form instanceof HTMLFormElement) {
    form.reset();
    form.hidden = false;
  }
  if (type instanceof HTMLSelectElement) {
    type.value = "bug";
  }
  if (confirmation instanceof HTMLElement) {
    confirmation.hidden = true;
  }
  if (attachmentSummary instanceof HTMLElement) {
    attachmentSummary.textContent = "No screenshot file selected.";
  }
  hooks.hideMessage?.("feedbackMessage");
  if (message instanceof HTMLElement) {
    message.textContent = "";
  }

  syncFeedbackFormCopy();
  syncContextPreview();
}

export function prepareFeedbackView() {
  syncFeedbackFormCopy();
  syncContextPreview();
}

export async function handleFeedbackSubmit(event) {
  event?.preventDefault?.();

  const { title, screenshotUrl } = getFeedbackElements();
  const type = getSelectedType();
  const titleValue =
    title instanceof HTMLInputElement ? title.value.trim() : "";
  const body = buildFeedbackBody(type);

  if (!titleValue) {
    hooks.showMessage?.(
      "feedbackMessage",
      "Please add a short title.",
      "error",
    );
    return;
  }

  if (!body) {
    hooks.showMessage?.(
      "feedbackMessage",
      "Please answer the feedback questions before sending.",
      "error",
    );
    return;
  }

  const payload = {
    type,
    title: titleValue,
    body,
    screenshotUrl:
      screenshotUrl instanceof HTMLInputElement && screenshotUrl.value.trim()
        ? screenshotUrl.value.trim()
        : null,
    attachmentMetadata: getAttachmentMetadata(),
    pageUrl: window.location.href,
    userAgent: window.navigator.userAgent || null,
    appVersion: readAppVersion(),
  };

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "feedbackMessage",
        data.error || "We could not send your feedback.",
        "error",
      );
      return;
    }

    hooks.hideMessage?.("feedbackMessage");
    showConfirmation(type, data.id);
  } catch (error) {
    hooks.showMessage?.(
      "feedbackMessage",
      "We could not send your feedback.",
      "error",
    );
  }
}
