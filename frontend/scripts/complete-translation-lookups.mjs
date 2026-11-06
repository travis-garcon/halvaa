import { readFile, writeFile } from "node:fs/promises";

const locales = ["en", "fa", "ar", "zh"];
const missing = {
  auth: ["avatar_invalid_type", "avatar_too_large", "close", "own_info_hint", "your_full_name", "your_full_name_example", "your_photo", "choose_your_photo", "avatar_preview_title", "avatar_preview_hint", "avatar_use", "cancel", "remove"],
  editMemorial: ["uploadInvalidType", "uploadTooLarge", "deleteSuccess", "deleteError", "calendar.persian", "calendar.gregorian", "calendar.year", "calendar.month", "calendar.day", "calendar.converted", "calendar.empty", "autosave.saving", "autosave.saved", "autosave.error", "autosave.waiting", "wizardTitle", "help.name", "help.birthDate", "help.deathDate", "help.biography", "help.epitaph", "optionalDetails", "bannerPreviewEmpty", "bannerImage", "portraitImage", "choosePhoto", "help.gallery", "chooseMedia", "help.timelineDate", "deleteTitle", "deleteHint", "deleteAction", "previewUploadTitle", "previewUploadHint", "useSelectedMedia", "deleteConfirm", "deleting"],
  profile: ["avatarInvalidType", "avatarTooLarge", "avatarSaved", "deleteSuccess", "deleteError", "filterDrafts", "yourProfilePhoto", "chooseProfilePhoto", "searchMemorials", "removeMemorial", "avatarPreviewTitle", "avatarPreviewHint", "useProfilePhoto", "deleteTitle", "deleteConfirm", "deleting"],
};

const translations = {
  en: {
    auth: { avatar_invalid_type: "Choose a JPG, PNG, or WebP image.", avatar_too_large: "This photo is too large. Maximum size: {size}.", close: "Close", own_info_hint: "These are your account details, not the details of the person remembered.", your_full_name: "Your full name", your_full_name_example: "Example: Alex Morgan", your_photo: "Your profile photo", choose_your_photo: "Choose your photo", avatar_preview_title: "Profile photo preview", avatar_preview_hint: "This is how your profile photo will appear.", avatar_use: "Use this photo", cancel: "Cancel", remove: "Remove" },
    editMemorial: { deleteSuccess: "Memorial deleted.", deleteError: "Could not delete memorial.", bannerImage: "Banner photo", portraitImage: "Portrait photo", optionalDetails: "Optional details", deleteTitle: "Delete memorial", deleteHint: "This permanently removes the memorial and its media.", deleteAction: "Delete permanently", deleteConfirm: "Delete {name}? This cannot be undone.", deleting: "Deleting…" },
    profile: { avatarInvalidType: "Choose a JPG, PNG, or WebP image.", avatarTooLarge: "This photo is too large. Maximum size: {size}.", avatarSaved: "Profile photo updated.", deleteSuccess: "Memorial deleted.", deleteError: "Could not delete memorial.", filterDrafts: "Drafts", yourProfilePhoto: "Your profile photo", chooseProfilePhoto: "Choose a profile photo", searchMemorials: "Search your memorials", removeMemorial: "Remove memorial", avatarPreviewTitle: "Profile photo preview", avatarPreviewHint: "This is how your profile photo will appear.", useProfilePhoto: "Use profile photo", deleteTitle: "Delete memorial", deleteConfirm: "Delete {name}? This cannot be undone.", deleting: "Deleting…" },
  },
  fa: {
    auth: { avatar_invalid_type: "یک تصویر JPG، PNG یا WebP انتخاب کنید.", avatar_too_large: "این عکس بیش از حد بزرگ است. حداکثر اندازه: {size}.", close: "بستن", own_info_hint: "این اطلاعات مربوط به حساب شماست، نه فردی که برای او یادبود می‌سازید.", your_full_name: "نام و نام خانوادگی شما", your_full_name_example: "مثال: علی رضایی", your_photo: "عکس پروفایل شما", choose_your_photo: "عکس خود را انتخاب کنید", avatar_preview_title: "پیش‌نمایش عکس پروفایل", avatar_preview_hint: "این عکس در پروفایل شما نمایش داده می‌شود.", avatar_use: "استفاده از این عکس", cancel: "لغو", remove: "حذف" },
    editMemorial: { deleteSuccess: "یادبود حذف شد.", deleteError: "حذف یادبود ممکن نشد.", bannerImage: "عکس بنر", portraitImage: "عکس پرتره", optionalDetails: "جزئیات اختیاری", deleteTitle: "حذف یادبود", deleteHint: "این کار یادبود و رسانه‌های آن را برای همیشه حذف می‌کند.", deleteAction: "حذف دائمی", deleteConfirm: "یادبود {name} حذف شود؟ این کار قابل بازگشت نیست.", deleting: "در حال حذف…" },
    profile: { avatarInvalidType: "یک تصویر JPG، PNG یا WebP انتخاب کنید.", avatarTooLarge: "این عکس بیش از حد بزرگ است. حداکثر اندازه: {size}.", avatarSaved: "عکس پروفایل به‌روزرسانی شد.", deleteSuccess: "یادبود حذف شد.", deleteError: "حذف یادبود ممکن نشد.", filterDrafts: "پیش‌نویس‌ها", yourProfilePhoto: "عکس پروفایل شما", chooseProfilePhoto: "انتخاب عکس پروفایل", searchMemorials: "جست‌وجوی یادبودهای شما", removeMemorial: "حذف یادبود", avatarPreviewTitle: "پیش‌نمایش عکس پروفایل", avatarPreviewHint: "این عکس در پروفایل شما نمایش داده می‌شود.", useProfilePhoto: "استفاده از عکس پروفایل", deleteTitle: "حذف یادبود", deleteConfirm: "یادبود {name} حذف شود؟ این کار قابل بازگشت نیست.", deleting: "در حال حذف…" },
  },
  ar: {
    auth: { avatar_invalid_type: "اختر صورة JPG أو PNG أو WebP.", avatar_too_large: "الصورة كبيرة جدًا. الحد الأقصى: {size}.", close: "إغلاق", own_info_hint: "هذه بيانات حسابك، وليست بيانات الشخص الذي تتذكره.", your_full_name: "اسمك الكامل", your_full_name_example: "مثال: أحمد علي", your_photo: "صورتك الشخصية", choose_your_photo: "اختر صورتك", avatar_preview_title: "معاينة الصورة الشخصية", avatar_preview_hint: "ستظهر هذه الصورة في ملفك الشخصي.", avatar_use: "استخدام هذه الصورة", cancel: "إلغاء", remove: "إزالة" },
    editMemorial: { deleteSuccess: "تم حذف النصب التذكاري.", deleteError: "تعذر حذف النصب التذكاري.", bannerImage: "صورة الغلاف", portraitImage: "الصورة الشخصية", optionalDetails: "تفاصيل اختيارية", deleteTitle: "حذف النصب التذكاري", deleteHint: "سيؤدي ذلك إلى حذف النصب ووسائطه نهائيًا.", deleteAction: "حذف نهائي", deleteConfirm: "حذف {name}؟ لا يمكن التراجع عن ذلك.", deleting: "جارٍ الحذف…" },
    profile: { avatarInvalidType: "اختر صورة JPG أو PNG أو WebP.", avatarTooLarge: "الصورة كبيرة جدًا. الحد الأقصى: {size}.", avatarSaved: "تم تحديث الصورة الشخصية.", deleteSuccess: "تم حذف النصب التذكاري.", deleteError: "تعذر حذف النصب التذكاري.", filterDrafts: "المسودات", yourProfilePhoto: "صورتك الشخصية", chooseProfilePhoto: "اختر صورة شخصية", searchMemorials: "ابحث في نصبك التذكارية", removeMemorial: "إزالة النصب التذكاري", avatarPreviewTitle: "معاينة الصورة الشخصية", avatarPreviewHint: "ستظهر هذه الصورة في ملفك الشخصي.", useProfilePhoto: "استخدام الصورة الشخصية", deleteTitle: "حذف النصب التذكاري", deleteConfirm: "حذف {name}؟ لا يمكن التراجع عن ذلك.", deleting: "جارٍ الحذف…" },
  },
  zh: {
    auth: { avatar_invalid_type: "请选择 JPG、PNG 或 WebP 图片。", avatar_too_large: "图片太大。最大大小：{size}。", close: "关闭", own_info_hint: "这些是您的账户信息，不是被纪念者的信息。", your_full_name: "您的全名", your_full_name_example: "例如：李明", your_photo: "您的头像", choose_your_photo: "选择您的照片", avatar_preview_title: "头像预览", avatar_preview_hint: "这是头像在个人资料中的显示方式。", avatar_use: "使用此照片", cancel: "取消", remove: "移除" },
    editMemorial: { deleteSuccess: "纪念馆已删除。", deleteError: "无法删除纪念馆。", bannerImage: "横幅照片", portraitImage: "肖像照片", optionalDetails: "可选详情", deleteTitle: "删除纪念馆", deleteHint: "这将永久删除纪念馆及其媒体。", deleteAction: "永久删除", deleteConfirm: "删除 {name}？此操作无法撤销。", deleting: "正在删除…" },
    profile: { avatarInvalidType: "请选择 JPG、PNG 或 WebP 图片。", avatarTooLarge: "图片太大。最大大小：{size}。", avatarSaved: "头像已更新。", deleteSuccess: "纪念馆已删除。", deleteError: "无法删除纪念馆。", filterDrafts: "草稿", yourProfilePhoto: "您的头像", chooseProfilePhoto: "选择头像", searchMemorials: "搜索您的纪念馆", removeMemorial: "删除纪念馆", avatarPreviewTitle: "头像预览", avatarPreviewHint: "这是头像在个人资料中的显示方式。", useProfilePhoto: "使用头像", deleteTitle: "删除纪念馆", deleteConfirm: "删除 {name}？此操作无法撤销。", deleting: "正在删除…" },
  },
};

function setPath(target, path, value) {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) current = current[part] ??= {};
  current[parts.at(-1)] = value;
}

for (const locale of locales) {
  const file = `frontend/messages/${locale}.json`;
  const catalog = JSON.parse(await readFile(file, "utf8"));
  for (const [namespace, keys] of Object.entries(missing)) {
    for (const key of keys) {
      const existing = key.split(".").reduce((value, part) => value?.[part], catalog[namespace]);
      if (existing !== undefined) continue;
      let value = translations[locale]?.[namespace]?.[key];
      if (value === undefined && namespace === "editMemorial") {
        value = key.split(".").reduce((v, part) => v?.[part], catalog.createMemorial);
      }
      if (value === undefined) value = key;
      setPath(catalog[namespace], key, value);
    }
  }
  await writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}
