import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/klipy";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const KLIPY_API_KEY = Deno.env.get("KLIPY_API_KEY");
    if (!LOVABLE_API_KEY || !KLIPY_API_KEY) {
      throw new Error("GIF service is not configured");
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").slice(0, 100).trim();
    const customerId = (url.searchParams.get("customer_id") || "chat-app").slice(0, 64);

    // Public surface: restrict strictly to gifs trending/search
    const endpoint = q ? "search" : "trending";
    const params = new URLSearchParams({
      customer_id: customerId,
      per_page: "24",
    });
    if (q) params.set("q", q);

    const response = await fetch(`${GATEWAY_URL}/gifs/${endpoint}?${params}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": KLIPY_API_KEY,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Klipy gateway failed [${response.status}]: ${errorBody}`);
      return new Response(
        JSON.stringify({ error: "GIF provider request failed", status: response.status }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    if (!data.result) {
      console.error(`Klipy error: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ error: "GIF provider error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = (data?.data?.data ?? [])
      .map((item: any) => {
        const f = item?.file ?? {};
        const url = f?.md?.gif?.url || f?.hd?.gif?.url || f?.sm?.gif?.url || "";
        const preview = f?.sm?.webp?.url || f?.sm?.gif?.url || f?.md?.gif?.url || f?.xs?.gif?.url || url;
        return url ? { url, preview } : null;
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ gifs: items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("klipy-gifs error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
