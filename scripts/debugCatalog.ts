import 'dotenv/config';
import { getCatalogPayload } from "@/lib/inventory";

(async () => {
  try {
    const payload = await getCatalogPayload();
    console.log(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
})();
