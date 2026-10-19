"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", display: "grid", minHeight: "100vh", placeItems: "center" }}>
        <title>Lỗi hệ thống · OmniFlow</title>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Đã có lỗi xảy ra</h1>
          <p style={{ color: "#666", marginBottom: 24 }}>Hệ thống gặp sự cố. Vui lòng thử lại sau ít phút.</p>
          <button type="button" onClick={() => retry()} style={{ padding: "8px 16px", cursor: "pointer" }}>
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
