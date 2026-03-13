const express = require("express");
const app = express();
app.use(express.json({ limit: "50mb" }));

// ═══════════════════════════════════════════════════
// CONFIGURATION — ALL VIA ENVIRONMENT VARIABLES
// Change these per restaurant. No code changes needed.
//
// REQUIRED:
//   RESTAURANT_ID   — Supermenu POS restaurant ID
//   PASSWORD         — Supermenu online ordering password
//
// OPTIONAL:
//   SUPERMENU_URL    — default: https://www.mealage.us/aivoice/orders.jsp
//   TAX_RATE         — default: 0.06 (6%)
//   DELIVERY_FEE     — default: 1.95
//   GOOGLE_MAPS_API_KEY — for address verification
//   RESTAURANT_LAT   — for delivery distance check
//   RESTAURANT_LNG   — for delivery distance check
//   MAX_DELIVERY_MILES — default: 4
//   PORT             — default: 3000
// ═══════════════════════════════════════════════════
var CONFIG = {
  RESTAURANT_ID: process.env.RESTAURANT_ID || "80001",
  PASSWORD: process.env.PASSWORD || "ABC888",
  SUPERMENU_URL: process.env.SUPERMENU_URL || "https://www.mealage.us/aivoice/orders.jsp",
  TAX_RATE: parseFloat(process.env.TAX_RATE || "0.06"),
  DELIVERY_FEE: parseFloat(process.env.DELIVERY_FEE || "1.95"),
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  RESTAURANT_LAT: parseFloat(process.env.RESTAURANT_LAT || "0"),
  RESTAURANT_LNG: parseFloat(process.env.RESTAURANT_LNG || "0"),
  MAX_DELIVERY_MILES: parseFloat(process.env.MAX_DELIVERY_MILES || "4"),
  PORT: process.env.PORT || 3000,
};

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function genRef() {
  return Math.floor(100000 + Math.random() * 900000);
}

function timeNow() {
  var d = new Date();
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════
// BUILD XML — UNIVERSAL, NO PRICE CHANGES
// Passes through ALL prices exactly as the agent sends them.
// Server never recalculates — agent handles pricing via KB.
//
// POS COLORS (controlled by XML tags):
//   RED  = <groupMame> content
//   BLACK = <name> content
//   BLUE = <additionalRequirements> content
// ═══════════════════════════════════════════════════
function buildItem(item) {
  var x = "<OrderLineItem>";
  x += "<itemName>" + esc(item.item_name || item.name || "Item") + "</itemName>";

  // Item special request → BLUE in POS
  if (item.special_instructions) {
    x += "<additionalRequirements>" + esc(item.special_instructions) + "</additionalRequirements>";
  }

  x += "<quantity>" + (item.quantity || 1) + "</quantity>";
  x += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  x += "<printKitchen>Y</printKitchen>";

  // ═══ COMBO DEAL ═══
  if (item.is_combo && item.components && item.components.length > 0) {
    x += "<Requirements>";
    for (var c = 0; c < item.components.length; c++) {
      var comp = item.components[c];

      // Component name → RED in POS (via groupMame)
      x += "<Requirement>";
      x += "<groupMame>" + esc(comp.component_name) + "</groupMame>";
      x += "<name>" + esc(comp.component_name) + "</name>";
      x += "<quantity>1</quantity>";
      x += "<price>0.00</price>";
      x += "</Requirement>";

      // Component special request → BLUE
      if (comp.special_instructions) {
        x += "<Requirement>";
        x += "<groupMame>Special Request</groupMame>";
        x += "<name>" + esc(comp.special_instructions) + "</name>";
        x += "<quantity>1</quantity>";
        x += "<price>0.00</price>";
        x += "</Requirement>";
      }

      // Modifiers → group label RED, value BLACK
      // Price passed through as-is from agent
      if (comp.modifiers && comp.modifiers.length > 0) {
        for (var m = 0; m < comp.modifiers.length; m++) {
          var mod = comp.modifiers[m];
          x += "<Requirement>";
          if (mod.group) x += "<groupMame>" + esc(mod.group) + "</groupMame>";
          x += "<name>" + esc(mod.name) + "</name>";
          x += "<quantity>1</quantity>";
          x += "<price>" + parseFloat(mod.price || 0).toFixed(2) + "</price>";
          x += "</Requirement>";
        }
      }
    }
    x += "</Requirements>";
  }
  // ═══ REGULAR ITEM ═══
  else if (item.modifiers && item.modifiers.length > 0) {
    x += "<Requirements>";
    for (var i = 0; i < item.modifiers.length; i++) {
      var mod2 = item.modifiers[i];
      x += "<Requirement>";
      if (mod2.group) x += "<groupMame>" + esc(mod2.group) + "</groupMame>";
      x += "<name>" + esc(mod2.name || mod2) + "</name>";
      x += "<quantity>1</quantity>";
      x += "<price>" + parseFloat(mod2.price || 0).toFixed(2) + "</price>";
      x += "</Requirement>";
    }
    x += "</Requirements>";
  }

  x += "</OrderLineItem>";
  return x;
}

function buildXml(order) {
  var ref = genRef();
  var sub = parseFloat(order.subtotal || 0);
  var tax = parseFloat(order.tax || (sub * CONFIG.TAX_RATE));
  var del = order.order_type === "delivery" ? CONFIG.DELIVERY_FEE : 0;
  var tot = parseFloat(order.total || (sub + tax + del));
  var type = order.order_type === "delivery" ? "Delivery" : "Pick-Up";

  var nm = (order.customer_name || "Guest").trim().split(/\s+/);
  var fn = nm[0] || "Guest";
  var ln = nm.slice(1).join(" ") || "Order";
  var ph = (order.customer_phone || "0000000000").replace(/\D/g, "");

  var x = "<FoodOrder>";
  x += "<referenceNumber>" + ref + "</referenceNumber>";
  x += "<timeString>" + timeNow() + "</timeString>";
  x += "<type>" + type + "</type>";
  // Order-level special instructions → shows as NOTES in POS
  x += "<comments>" + esc(order.special_instructions || order.comments || "") + "</comments>";
  x += "<payment>CASH</payment>";
  x += "<subtotal>" + sub.toFixed(2) + "</subtotal>";
  x += "<tax>" + tax.toFixed(2) + "</tax>";
  x += "<total>" + tot.toFixed(2) + "</total>";
  if (del > 0) x += "<deliveryCharge>" + del.toFixed(2) + "</deliveryCharge>";

  x += "<Customer>";
  x += "<firstName>" + esc(fn) + "</firstName>";
  x += "<lastName>" + esc(ln) + "</lastName>";
  x += "<phoneAreaCode>" + ph.substring(0, 3) + "</phoneAreaCode>";
  x += "<phone>" + ph.substring(3) + "</phone>";
  x += "<email>order@aivoice.com</email>";
  x += "</Customer>";

  if (order.order_type === "delivery" && order.delivery_address) {
    x += "<Address>";
    x += "<addressLine1>" + esc(order.delivery_address) + "</addressLine1>";
    x += "<addressLine2></addressLine2><city></city><state></state><zip></zip>";
    x += "</Address>";
  }

  x += "<Items>";
  if (order.items && order.items.length > 0) {
    for (var i = 0; i < order.items.length; i++) x += buildItem(order.items[i]);
  }
  x += "</Items></FoodOrder>";
  return { xml: x, ref: ref };
}

// ═══════════════════════════════════════════════════
// SEND TO POS — try multiple content types, capture all responses
// ═══════════════════════════════════════════════════
async function sendToPOS(xml) {
  var url = CONFIG.SUPERMENU_URL + "?id=" + CONFIG.RESTAURANT_ID + "&password=" + CONFIG.PASSWORD;
  var lastResponse = "";

  // Attempt 1: text/xml
  try {
    var r1 = await fetch(url, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8" }, body: xml });
    var t1 = await r1.text();
    lastResponse = t1;
    console.log("POS attempt 1 (text/xml): " + r1.status + " " + t1);
    if (t1.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t1 };
  } catch (e) { console.log("Attempt 1 error: " + e.message); lastResponse = e.message; }

  // Attempt 2: application/xml
  try {
    var r2 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/xml; charset=utf-8" }, body: xml });
    var t2 = await r2.text();
    lastResponse = t2;
    console.log("POS attempt 2 (application/xml): " + r2.status + " " + t2);
    if (t2.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t2 };
  } catch (e) { console.log("Attempt 2 error: " + e.message); lastResponse = e.message; }

  // Attempt 3: form-encoded
  try {
    var r3 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "xml=" + encodeURIComponent(xml) });
    var t3 = await r3.text();
    lastResponse = t3;
    console.log("POS attempt 3 (form): " + r3.status + " " + t3);
    if (t3.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t3 };
  } catch (e) { console.log("Attempt 3 error: " + e.message); lastResponse = e.message; }

  return { ok: false, response: "POS rejected. Last response: " + lastResponse };
}

// ═══════════════════════════════════════════════════
// ORDER LOG
// ═══════════════════════════════════════════════════
var orderLog = [];

// ═══════════════════════════════════════════════════
// ROUTE: Submit order (from Retell)
// ═══════════════════════════════════════════════════
app.post("/retell/function/submit_order", async function (req, res) {
  var log = { time: new Date().toISOString(), status: null, error: null };
  try {
    var data = req.body.args || req.body;
    log.args = data;
    console.log("\n=== ORDER FROM RETELL ===");
    console.log(JSON.stringify(data, null, 2));

    var built = buildXml(data);
    log.xml = built.xml;
    log.ref = built.ref;
    console.log("\n=== XML ===\n" + built.xml);

    var result = await sendToPOS(built.xml);
    log.pos = result;
    log.status = result.ok ? "SUCCESS" : "POS_ISSUE";

    if (result.ok) {
      res.json("Order placed! Reference number " + built.ref + ". " + result.response);
    } else {
      res.json("Order received, ref " + built.ref + ". Staff will confirm.");
    }
  } catch (e) {
    log.status = "ERROR";
    log.error = e.message;
    console.error("ERROR:", e);
    res.json("Order noted. Staff will process shortly.");
  }
  orderLog.unshift(log);
  if (orderLog.length > 10) orderLog.pop();
});

// ═══════════════════════════════════════════════════
// ROUTE: Verify address (Google Maps)
// ═══════════════════════════════════════════════════
app.post("/retell/function/verify_address", async function (req, res) {
  try {
    var data = req.body.args || req.body;
    var addr = data.address;
    if (!addr || addr.trim().length < 5) return res.json("INVALID: No address. Ask for full address.");
    if (!CONFIG.GOOGLE_MAPS_API_KEY) return res.json("FOUND: Address accepted. " + addr);

    var r = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(addr) + "&key=" + CONFIG.GOOGLE_MAPS_API_KEY);
    var geo = await r.json();
    if (geo.status !== "OK" || !geo.results || !geo.results.length) return res.json("NOT_FOUND: Ask customer to spell street name.");

    var place = geo.results[0];
    var fmt = place.formatted_address;
    var loc = place.geometry.location;

    if (CONFIG.RESTAURANT_LAT !== 0) {
      var R = 3958.8, dLat = ((loc.lat - CONFIG.RESTAURANT_LAT) * Math.PI) / 180, dLng = ((loc.lng - CONFIG.RESTAURANT_LNG) * Math.PI) / 180;
      var a2 = Math.sin(dLat / 2) ** 2 + Math.cos(CONFIG.RESTAURANT_LAT * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      var dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2)) * 10) / 10;
      if (dist > CONFIG.MAX_DELIVERY_MILES) return res.json("OUT_OF_RANGE: " + dist + " miles. Max " + CONFIG.MAX_DELIVERY_MILES + ". Address: " + fmt);
    }

    var hasNum = place.address_components && place.address_components.some(function (c) { return c.types.indexOf("street_number") !== -1; });
    if (!hasNum) return res.json("PARTIAL: Found area but not exact address: " + fmt + ". Ask for house number.");
    return res.json("FOUND: " + fmt + ".");
  } catch (e) { return res.json("FOUND: Address accepted. " + (req.body.args && req.body.args.address || "")); }
});

// ═══════════════════════════════════════════════════
// DEBUG + TEST
// ═══════════════════════════════════════════════════
app.get("/debug", function (req, res) { res.json({ total: orderLog.length, orders: orderLog }); });

app.get("/test-order", async function (req, res) {
  var order = {
    order_type: "pickup", customer_name: "Test Regular", customer_phone: "8888888888",
    items: [{ item_name: '14" Large Cheese Pizza', quantity: 1, unit_price: 11.99, modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }] }],
    subtotal: 13.99, tax: 0.84, total: 14.83,
  };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-combo", async function (req, res) {
  var order = {
    order_type: "pickup", customer_name: "Test Combo", customer_phone: "8888888888",
    items: [{
      item_name: '12"PIZZA W/1 TOP 8"SUB, 6 BUFFALO WING & 2 CAN OF SODA',
      quantity: 1, unit_price: 29.99, is_combo: true,
      components: [
        { component_name: '12" Cheese Pizza', modifiers: [{ group: "Add Toppings", name: "Jalapeños Peppers", price: 0 }] },
        { component_name: '8" Sub', modifiers: [{ group: "Choice of Grilled Subs", name: "CHEESE STEAK SUB", price: 0 }, { group: "Sub Fixins", name: "Everything", price: 0 }, { group: "Cheese Options", name: "American", price: 0 }] },
        { component_name: "6 Buffalo Wings", modifiers: [{ group: "Wings - Flavors", name: "Hot", price: 0 }, { group: "Wings - Dressing", name: "Ranch", price: 0 }] },
        { component_name: "Can Soda", modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
        { component_name: "Can Soda", modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
      ]
    }],
    subtotal: 29.99, tax: 1.80, total: 31.79,
  };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ xml: built.xml, pos: result, ref: built.ref });
});

// ═══════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════
app.get("/", function (req, res) {
  res.json({
    status: "running",
    restaurant_id: CONFIG.RESTAURANT_ID,
    endpoints: ["POST /retell/function/submit_order", "POST /retell/function/verify_address", "GET /test-order", "GET /test-combo", "GET /debug"],
  });
});

app.listen(CONFIG.PORT, function () {
  console.log("POS Bridge | Port: " + CONFIG.PORT + " | Restaurant: " + CONFIG.RESTAURANT_ID);
});
