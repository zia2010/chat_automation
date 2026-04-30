fetch("https://httpbin.org/get")
  .then(r => r.json())
  .then(d => console.log("External fetch OK"))
  .catch(e => console.log("External fetch FAIL:", e.message));

fetch("https://mhwdassapzwmzyfyyotb.supabase.co")
  .then(r => console.log("Supabase reachable, status:", r.status))
  .catch(e => console.log("Supabase FAIL:", e.message));
