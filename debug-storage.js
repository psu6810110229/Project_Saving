const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const owners = [
  "27299c71-015e-4bb6-98b5-91734fcf902c",
  "6215f81a-5509-4fb2-ad27-69ec1cb22c10",
  "11099780-4dba-4428-a653-04633f628310"
];

const headers = { apikey: key, Authorization: "Bearer " + key };

(async () => {
  const listUrl = url + "/rest/v1/storage.objects?select=bucket_id,name,owner&owner=in.(" + owners.join(",") + ")";
  const res = await fetch(listUrl, { headers });
  const text = await res.text();
  console.log("status:", res.status);
  console.log(text);
})();
