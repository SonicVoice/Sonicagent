const express = require("express");
const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════════
// CONFIGURATION — EDIT FOR EACH RESTAURANT
// ═══════════════════════════════════════════════════
const CONFIG = {
  RESTAURANT_ID: process.env.RESTAURANT_ID || "80001",
  PASSWORD: process.env.PASSWORD || "ABC888",
  SUPERMENU_URL: "https://www.mealage.us/aivoice/orders.jsp",
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
  if (item.item_id || item.food_menu_item_id) {
    x += `<foodMenuItemId>${esc(item.item_id || item.food_menu_item_id)}</foodMenuItemId>`;
  }
  x += `<quantity>${item.quantity || 1}</quantity>`;
  x += `<unitPrice>${parseFloat(item.unit_price || item.price || 0).toFixed(2)}</unitPrice>`;
  x += `<printKitchen>Y</printKitchen>`;

  if (item.modifiers && item.modifiers.length > 0) {
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

// ═══════════════════════════════════════════════════
// ROUTE: Submit order (called by Retell agent)
// ═══════════════════════════════════════════════════
app.post("/retell/function/submit_order", async (req, res) => {
  try {
    const orderData = req.body.args || req.body;
    console.log("\n=== ORDER FROM RETELL ===");
    console.log(JSON.stringify(orderData, null, 2));

    const { xml, refNumber } = buildOrderXml(orderData);
    console.log("\n=== XML ===");
    console.log(xml);

    const result = await sendToPOS(xml);
    console.log("\n=== RESULT ===", result);

    if (result.ok) {
      res.json(`Order placed successfully! Reference number ${refNumber}. ${result.response}`);
    } else {
      res.json(`Order received, reference number ${refNumber}. Staff will confirm. POS response: ${result.response}`);
    }
  } catch (error) {
    console.error("ERROR:", error);
    res.json("Order has been noted. Staff will process it shortly.");
  }
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
      item_id: "737",
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
// HEALTH
// ═══════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.json({
    status: "running",
    restaurant_id: CONFIG.RESTAURANT_ID,
    test: "Visit /test-order to send a test order to POS",
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`POS Bridge on port ${CONFIG.PORT} | Restaurant: ${CONFIG.RESTAURANT_ID}`);
});
