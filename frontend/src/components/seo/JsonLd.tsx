import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

// JSON-LD cho trang chủ. Chỉ khai báo thông tin có thật (tên, url, logo, mô tả) —
// KHÔNG thêm rating/review/số liệu chưa được xác thực (xem nguyên tắc trong CLAUDE.md).
export default function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: "vi-VN",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // Escape "<" để chuỗi JSON không thể đóng thẻ <script> sớm.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
