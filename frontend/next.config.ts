import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // ── TOUT pointe vers le backend unifié sur port 8000 ─────────────────
      // (api.py sur 8001 est supprimé — tout est dans main.py sur 8000)

      // Career Assistant API (login, profile, matches, gap, roadmap, chat, report)
      { source: "/api/:path*",     destination: "http://localhost:8000/api/:path*" },

      // JobScan pipeline (SSE scan + cached jobs + profile PATCH)
      { source: "/scan",           destination: "http://localhost:8000/scan" },
      { source: "/jobs/:path*",    destination: "http://localhost:8000/jobs/:path*" },
      { source: "/profile/:path*", destination: "http://localhost:8000/profile/:path*" },
      { source: "/cv",             destination: "http://localhost:8000/cv" },
      { source: "/enhance-cv-for-job", destination: "http://localhost:8000/enhance-cv-for-job" },
      { source: "/apply-format",        destination: "http://localhost:8000/apply-format" },
      { source: "/job-data/:path*", destination: "http://localhost:8000/job-data/:path*" },
    ];
  },
};

export default nextConfig;