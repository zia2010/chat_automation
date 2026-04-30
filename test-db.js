import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

console.log("URL:", process.env.SUPABASE_URL);
console.log("KEY length:", process.env.SUPABASE_KEY?.length);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const { data, error } = await supabase.from("clients").select("id").limit(1);

if (error) {
  console.log("ERROR:", error.message);
} else {
  console.log("SUCCESS:", data);
}
