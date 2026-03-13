const express = require("express");
const app = express();
app.use(express.json({ limit: "50mb" }));

// ═══════════════════════════════════════════════════
// CONFIGURATION — EDIT FOR EACH RESTAURANT
// ═══════════════════════════════════════════════════
const CONFIG = {
  RESTAURANT_ID: process.env.RESTAURANT_ID || "80001",
  PASSWORD: process.env.PASSWORD || "ABC888",
  SUPERMENU_URL: "https://www.mealage.us/aivoice/orders.jsp",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  RESTAURANT_LAT: parseFloat(process.env.RESTAURANT_LAT || "38.9687"),  // Pizza Demo Reston
  RESTAURANT_LNG: parseFloat(process.env.RESTAURANT_LNG || "-77.3411"),
  MAX_DELIVERY_MILES: parseFloat(process.env.MAX_DELIVERY_MILES || "4"),
  TAX_RATE: 0.06,
  DELIVERY_FEE: 1.95,
  PORT: process.env.PORT || 3000,
};

function generateReferenceNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

function getTimeString() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}/${mo}/${d} ${h}:${mi}:${s}`;
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function buildOrderLineItem(item) {
  let x = `<OrderLineItem>`;
  x += `<itemName>${esc(item.item_name || item.name || "Item")}</itemName>`;
  if (item.additional_requirements || item.special_instructions) {
    x += `<additionalRequirements>${esc(item.additional_requirements || item.special_instructions)}</additionalRequirements>`;
  }
  x += `<quantity>${item.quantity || 1}</quantity>`;
  x += `<unitPrice>${parseFloat(item.unit_price || item.price || 0).toFixed(2)}</unitPrice>`;
  x += `<printKitchen>Y</printKitchen>`;

  // ═══ COMBO ITEMS: each component becomes Requirements ═══
  if (item.is_combo && item.components && item.components.length > 0) {
    x += `<Requirements>`;
    for (const comp of item.components) {
      // Component header (e.g., "12" Cheese Pizza", "8" Sub", "6 Buffalo Wings", "Can Soda")
      x += `<Requirement>`;
      x += `<groupMame>${esc(comp.component_name)}</groupMame>`;
      x += `<name>${esc(comp.component_name)}</name>`;
      x += `<quantity>1</quantity>`;
      x += `<price>0.00</price>`;
      x += `</Requirement>`;

      // Each modifier under this component (e.g., toppings, fixins, flavors, soda choice)
      if (comp.modifiers && comp.modifiers.length > 0) {
        for (const mod of comp.modifiers) {
          x += `<Requirement>`;
          x += `<groupMame>${esc(mod.group || "")}</groupMame>`;
          x += `<name>${esc(mod.name)}</name>`;
          x += `<quantity>1</quantity>`;
          x += `<price>${parseFloat(mod.price || 0).toFixed(2)}</price>`;
          x += `</Requirement>`;
        }
      }
    }
    x += `</Requirements>`;
  }
  // ═══ REGULAR ITEMS: modifiers as Requirements ═══
  else if (item.modifiers && item.modifiers.length > 0) {
    x += `<Requirements>`;
    for (const mod of item.modifiers) {
      x += `<Requirement>`;
      if (mod.group) x += `<groupMame>${esc(mod.group)}</groupMame>`;
      x += `<name>${esc(mod.name || mod)}</name>`;
      x += `<quantity>1</quantity>`;
      x += `<price>${parseFloat(mod.price || 0).toFixed(2)}</price>`;
      x += `</Requirement>`;
    }
    x += `</Requirements>`;
  }
  x += `</OrderLineItem>`;
  return x;
}

function buildOrderXml(orderData) {
  const refNumber = generateReferenceNumber();
  const timeString = getTimeString();
  const subtotal = parseFloat(orderData.subtotal || 0);
  const tax = parseFloat(orderData.tax || (subtotal * CONFIG.TAX_RATE));
  const deliveryCharge = orderData.order_type === "delivery" ? CONFIG.DELIVERY_FEE : 0;
  const total = parseFloat(orderData.total || (subtotal + tax + deliveryCharge));
  const orderType = orderData.order_type === "delivery" ? "Delivery" : "Pick-Up";

  const fullName = orderData.customer_name || "Guest";
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || "Guest";
  const lastName = parts.slice(1).join(" ") || "Order";
  const phone = (orderData.customer_phone || "0000000000").replace(/\D/g, "");
  const areaCode = phone.substring(0, 3) || "000";
  const phoneNum = phone.substring(3) || "0000000";

  let x = `<FoodOrder>`;
  x += `<referenceNumber>${refNumber}</referenceNumber>`;
  x += `<timeString>${timeString}</timeString>`;
  x += `<type>${orderType}</type>`;
  x += `<comments>${esc(orderData.special_instructions || "")}</comments>`;
  x += `<payment>CASH</payment>`;
  x += `<subtotal>${subtotal.toFixed(2)}</subtotal>`;
  x += `<tax>${tax.toFixed(2)}</tax>`;
  x += `<total>${total.toFixed(2)}</total>`;
  if (deliveryCharge > 0) x += `<deliveryCharge>${deliveryCharge.toFixed(2)}</deliveryCharge>`;

  x += `<Customer>`;
  x += `<firstName>${esc(firstName)}</firstName>`;
  x += `<lastName>${esc(lastName)}</lastName>`;
  x += `<phoneAreaCode>${areaCode}</phoneAreaCode>`;
  x += `<phone>${phoneNum}</phone>`;
  x += `<email>order@aivoice.com</email>`;
  x += `</Customer>`;

  if (orderData.order_type === "delivery" && orderData.delivery_address) {
    x += `<Address>`;
    x += `<addressLine1>${esc(orderData.delivery_address)}</addressLine1>`;
    x += `<addressLine2></addressLine2>`;
    x += `<city></city><state></state><zip></zip>`;
    x += `</Address>`;
  }

  x += `<Items>`;
  if (orderData.items && orderData.items.length > 0) {
    for (const item of orderData.items) x += buildOrderLineItem(item);
  }
  x += `</Items></FoodOrder>`;

  return { xml: x, refNumber };
}

// Try sending XML to POS with multiple content types
async function sendToPOS(xml) {
  const url = `${CONFIG.SUPERMENU_URL}?id=${CONFIG.RESTAURANT_ID}&password=${CONFIG.PASSWORD}`;

  // Attempt 1: text/xml
  console.log("Attempt 1: text/xml");
  try {
    const r1 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xml,
    });
    const t1 = await r1.text();
    console.log(`  Status: ${r1.status} Body: ${t1}`);
    if (t1.toLowerCase().includes("success")) return { ok: true, response: t1 };
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // Attempt 2: application/xml
  console.log("Attempt 2: application/xml");
  try {
    const r2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: xml,
    });
    const t2 = await r2.text();
    console.log(`  Status: ${r2.status} Body: ${t2}`);
    if (t2.toLowerCase().includes("success")) return { ok: true, response: t2 };
  } catch (e) { console.log(`  Error: ${e.message}`); }

  // Attempt 3: form-encoded with xml parameter
  console.log("Attempt 3: form-encoded");
  try {
    const r3 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `xml=${encodeURIComponent(xml)}`,
    });
    const t3 = await r3.text();
    console.log(`  Status: ${r3.status} Body: ${t3}`);
    if (t3.toLowerCase().includes("success")) return { ok: true, response: t3 };
    return { ok: false, response: t3 };
  } catch (e) { 
    console.log(`  Error: ${e.message}`);
    return { ok: false, response: e.message }; 
  }
}

// Store last 10 orders for debugging
const orderLog = [];

// ═══════════════════════════════════════════════════
// ROUTE: Submit order (called by Retell agent)
// ═══════════════════════════════════════════════════
app.post("/retell/function/submit_order", async (req, res) => {
  const logEntry = {
    time: new Date().toISOString(),
    raw_body: req.body,
    args: null,
    xml: null,
    pos_result: null,
    error: null,
  };

  try {
    const orderData = req.body.args || req.body;
    logEntry.args = orderData;
    console.log("\n=== ORDER FROM RETELL ===");
    console.log(JSON.stringify(orderData, null, 2));

    const { xml, refNumber } = buildOrderXml(orderData);
    logEntry.xml = xml;
    logEntry.refNumber = refNumber;
    console.log("\n=== XML ===");
    console.log(xml);

    const result = await sendToPOS(xml);
    logEntry.pos_result = result;
    console.log("\n=== RESULT ===", result);

    if (result.ok) {
      logEntry.status = "SUCCESS";
      res.json(`Order placed successfully! Reference number ${refNumber}. ${result.response}`);
    } else {
      logEntry.status = "POS_ISSUE";
      res.json(`Order received, reference number ${refNumber}. Staff will confirm. POS response: ${result.response}`);
    }
  } catch (error) {
    logEntry.status = "ERROR";
    logEntry.error = error.message;
    console.error("ERROR:", error);
    res.json("Order has been noted. Staff will process it shortly.");
  }

  orderLog.unshift(logEntry);
  if (orderLog.length > 10) orderLog.pop();
});

// ═══════════════════════════════════════════════════
// DEBUG: View last orders in browser
// Visit: https://your-server.onrender.com/debug
// ═══════════════════════════════════════════════════
app.get("/debug", (req, res) => {
  res.json({
    total_orders_logged: orderLog.length,
    orders: orderLog,
  });
});

// ═══════════════════════════════════════════════════
// TEST: Send test order to POS (open in browser)
// ═══════════════════════════════════════════════════
app.get("/test-order", async (req, res) => {
  const testOrder = {
    order_type: "pickup",
    customer_name: "Test Order",
    customer_phone: "8888888888",
    items: [{
      item_name: '14" Large Cheese Pizza',
      quantity: 1,
      unit_price: 11.99,
      modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }],
    }],
    subtotal: 13.99, tax: 0.84, total: 14.83,
  };

  const { xml, refNumber } = buildOrderXml(testOrder);
  const result = await sendToPOS(xml);

  res.json({
    step1_xml_generated: xml,
    step2_sent_to: `${CONFIG.SUPERMENU_URL}?id=${CONFIG.RESTAURANT_ID}&password=***`,
    step3_pos_response: result,
    reference_number: refNumber,
  });
});

// ═══════════════════════════════════════════════════
// TEST: Send a COMBO test order to POS
// Visit: https://your-server.onrender.com/test-combo
// ═══════════════════════════════════════════════════
app.get("/test-combo", async (req, res) => {
  const testCombo = {
    order_type: "pickup",
    customer_name: "Test Combo",
    customer_phone: "8888888888",
    items: [{
      item_name: '12"PIZZA W/1 TOP 8"SUB, 6 BUFFALO WING & 2 CAN OF SODA',
      quantity: 1,
      unit_price: 29.99,
      is_combo: true,
      components: [
        {
          component_name: '12" Cheese Pizza',
          modifiers: [
            { group: "Add Toppings", name: "Jalapeños Peppers", price: 0 }
          ]
        },
        {
          component_name: '8" Sub',
          modifiers: [
            { group: "Choice of Grilled Subs", name: "CHEESE STEAK SUB", price: 0 },
            { group: "Sub Fixins", name: "Everything", price: 0 },
            { group: "Cheese Options", name: "American", price: 0 }
          ]
        },
        {
          component_name: "6 Buffalo Wings",
          modifiers: [
            { group: "Wings - Flavors", name: "Hot", price: 0 },
            { group: "Wings - Dressing", name: "Ranch", price: 0 }
          ]
        },
        {
          component_name: "Can Soda",
          modifiers: [
            { group: "Soda Can", name: "Coke", price: 0 }
          ]
        },
        {
          component_name: "Can Soda",
          modifiers: [
            { group: "Soda Can", name: "Coke", price: 0 }
          ]
        }
      ]
    }],
    subtotal: 29.99, tax: 1.80, total: 31.79,
  };

  const { xml, refNumber } = buildOrderXml(testCombo);
  const result = await sendToPOS(xml);

  res.json({
    step1_xml_generated: xml,
    step2_sent_to: `${CONFIG.SUPERMENU_URL}?id=${CONFIG.RESTAURANT_ID}&password=***`,
    step3_pos_response: result,
    reference_number: refNumber,
  });
});

// ═══════════════════════════════════════════════════
// ROUTE: Verify delivery address via Google Maps
// ═══════════════════════════════════════════════════
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.post("/retell/function/verify_address", async (req, res) => {
  try {
    const orderData = req.body.args || req.body;
    const address = orderData.address;

    console.log("\n=== VERIFY ADDRESS ===");
    console.log("Input:", address);

    if (!address || address.trim().length < 5) {
      return res.json("INVALID: No address provided. Please ask the customer for their full delivery address including street number and street name.");
    }

    if (!CONFIG.GOOGLE_MAPS_API_KEY) {
      console.log("No Google Maps API key — skipping verification");
      return res.json(`FOUND: Address accepted as-is (no Maps API key configured). Address: ${address}`);
    }

    // Call Google Maps Geocoding API
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${CONFIG.GOOGLE_MAPS_API_KEY}`;

    const geoResponse = await fetch(url);
    const geoData = await geoResponse.json();

    console.log("Google Maps status:", geoData.status);
    console.log("Results:", geoData.results?.length || 0);

    if (geoData.status !== "OK" || !geoData.results || geoData.results.length === 0) {
      console.log("Address NOT FOUND");
      return res.json("NOT_FOUND: Google Maps could not find this address. Ask the customer to spell the street name and include the city and state.");
    }

    const result = geoData.results[0];
    const formatted = result.formatted_address;
    const location = result.geometry.location;

    console.log("Formatted:", formatted);
    console.log("Location:", location.lat, location.lng);

    // Check delivery distance
    const distance = haversineDistance(
      CONFIG.RESTAURANT_LAT, CONFIG.RESTAURANT_LNG,
      location.lat, location.lng
    );
    const distanceRounded = Math.round(distance * 10) / 10;

    console.log(`Distance: ${distanceRounded} miles (max: ${CONFIG.MAX_DELIVERY_MILES})`);

    if (distance > CONFIG.MAX_DELIVERY_MILES) {
      return res.json(`OUT_OF_RANGE: Address is ${distanceRounded} miles away, which is beyond our ${CONFIG.MAX_DELIVERY_MILES}-mile delivery range. Formatted address: ${formatted}. Ask if they want pickup instead.`);
    }

    // Check if the result has a street number (not just a city/zip)
    const hasStreetNumber = result.address_components?.some(
      (c) => c.types.includes("street_number")
    );

    if (!hasStreetNumber) {
      return res.json(`PARTIAL: Google Maps found a general area but not a specific street address. Formatted: ${formatted}. Ask the customer to include their house/building number.`);
    }

    return res.json(`FOUND: Address verified. Formatted address: ${formatted}. Distance: ${distanceRounded} miles. Delivery OK.`);

  } catch (error) {
    console.error("Address verification error:", error);
    return res.json(`FOUND: Address accepted (verification service unavailable). Address: ${req.body?.args?.address || "unknown"}`);
  }
});

// ═══════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.json({
    status: "running",
    restaurant_id: CONFIG.RESTAURANT_ID,
    test: "Visit /test-order to send a test order to POS",
    endpoints: {
      submit_order: "POST /retell/function/submit_order",
      verify_address: "POST /retell/function/verify_address",
      test_order: "GET /test-order",
    },
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`POS Bridge on port ${CONFIG.PORT} | Restaurant: ${CONFIG.RESTAURANT_ID}`);
});
