const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const deletions = {
  "avatars": [
    "11099780-4dba-4428-a653-04633f628310/avatar-1778584274849.jpg",
    "11099780-4dba-4428-a653-04633f628310/avatar-1778584300221.jpg",
    "11099780-4dba-4428-a653-04633f628310/avatar-1778584968018.jpg",
    "11099780-4dba-4428-a653-04633f628310/avatar-1778662315051.jpg",
    "11099780-4dba-4428-a653-04633f628310/avatar-1778677783437.jpg",
    "11099780-4dba-4428-a653-04633f628310/avatar-1778766242496.webp",
    "27299c71-015e-4bb6-98b5-91734fcf902c/avatar-1778584321721.jpg",
    "27299c71-015e-4bb6-98b5-91734fcf902c/avatar-1778585723098.jpg"
  ],
  "room-covers": [
    "11099780-4dba-4428-a653-04633f628310/cover-1779976294763.jpg",
    "11099780-4dba-4428-a653-04633f628310/cover-1779976532572.jpg",
    "11099780-4dba-4428-a653-04633f628310/cover-1779976992641.jpg",
    "11099780-4dba-4428-a653-04633f628310/cover-1780051284694.jpg",
    "11099780-4dba-4428-a653-04633f628310/cover-1780109221289.jpg",
    "11099780-4dba-4428-a653-04633f628310/cover-1780109616126.jpg"
  ]
};

const headers = { apikey: key, Authorization: "Bearer " + key };

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

(async () => {
  for (const [bucketId, paths] of Object.entries(deletions)) {
    for (const p of paths) {
      const urlPath = url + "/storage/v1/object/" + bucketId + "/" + encodePath(p);
      const res = await fetch(urlPath, { method: "DELETE", headers });
      if (!res.ok) {
        console.error("Failed " + bucketId + "/" + p + ":", await res.text());
      } else {
        console.log("Deleted " + bucketId + "/" + p);
      }
    }
  }
})();
