import fs from 'fs';
import path from 'path';
import readline from 'readline';

const HUB_COORDS: Record<string, { lat: number, lng: number }> = {
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Delhi': { lat: 28.7041, lng: 77.1025 },
  'New Delhi': { lat: 28.7041, lng: 77.1025 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Surat': { lat: 21.1702, lng: 72.8311 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Lucknow': { lat: 26.8467, lng: 80.9462 },
  'Kanpur': { lat: 26.4499, lng: 80.3319 },
  'Nagpur': { lat: 21.1458, lng: 79.0882 },
  'Indore': { lat: 22.7196, lng: 75.8577 },
  'Thane': { lat: 19.2183, lng: 72.9781 },
  'Bhopal': { lat: 23.2599, lng: 77.4126 },
  'Patna': { lat: 25.5941, lng: 85.1376 },
  'Vadodara': { lat: 22.3072, lng: 73.1812 }
};

const TARGET_DISTRICTS = Object.keys(HUB_COORDS);

async function generatePincodes() {
  const inputPath = path.join(process.cwd(), 'prisma/data/raw-pincodes.csv');
  const outputPath = path.join(process.cwd(), 'prisma/data/pincodes.json');
  
  const fileStream = fs.createReadStream(inputPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const pincodesMap = new Map();
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    
    const [rawPincode, rawDistrict, rawState] = line.split(',');

    const pincode = rawPincode?.replace(/"/g, '').trim();
    const district = rawDistrict?.replace(/"/g, '').trim();
    const state = rawState?.replace(/"/g, '').trim();

    if (!pincode || !district || !state) continue;

    const matchedHub = TARGET_DISTRICTS.find(hub => district.toLowerCase().includes(hub.toLowerCase()));

    if (matchedHub && !pincodesMap.has(pincode)) {
      const baseCoords = HUB_COORDS[matchedHub];
      
      const latOffset = (Math.random() - 0.5) * 0.15;
      const lngOffset = (Math.random() - 0.5) * 0.15;

      pincodesMap.set(pincode, {
        pincode: pincode,
        areaName: district, 
        city: district,     
        state: state,
        latitude: Number((baseCoords.lat + latOffset).toFixed(4)),
        longitude: Number((baseCoords.lng + lngOffset).toFixed(4))
      });
    }
  }

  const results = Array.from(pincodesMap.values());
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Generated ${results.length} deduplicated pincodes with mocked coordinates at ${outputPath}`);
}

generatePincodes().catch(console.error);