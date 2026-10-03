import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hostinger (and other Node hosts) deploy the self-contained server in .next/standalone
  output: "standalone",
  async redirects() {
    return [
      // Link blog cũ dạng /blog?category=x -> trang danh mục riêng (308, tốt cho SEO).
      // Phải làm ở đây: redirect trong page.tsx chạy sau khi loading.tsx đã stream nên chỉ ra 200 + meta refresh.
      {
        source: "/blog",
        has: [{ type: "query", key: "category", value: "(?<category>[a-z0-9-]+)" }],
        destination: "/blog/danh-muc/:category",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
