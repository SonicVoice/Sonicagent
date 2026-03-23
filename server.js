// VERSION: V14-2026-03-15
var express = require("express");
var app = express();
app.use(express.json({ limit: "50mb" }));

// Tag constants — built via concatenation to prevent any stripping
var NT = "<" + "na" + "me" + ">";
var NTC = "</" + "na" + "me" + ">";

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

function genRef() { return Math.floor(100000 + Math.random() * 900000); }

function timeNow() {
  var d = new Date();
  function p(n) { return n < 10 ? "0" + n : "" + n; }
  return d.getFullYear() + "/" + p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

function X(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Build a single regular item
function buildRegularItem(item) {
  var o = "<OrderLineItem>";
  o += "<itemName>" + X(item.item_name || item.name || "Item") + "</itemName>";
  if (item.special_instructions) {
    o += "<additionalRequirements>" + X(item.special_instructions) + "</additionalRequirements>";
  }
  if (item.item_id) {
    o += "<foodMenuItemId>" + X(item.item_id) + "</foodMenuItemId>";
  }
  o += "<quantity>" + (item.quantity || 1) + "</quantity>";
  o += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  o += "<printKitchen>Y</printKitchen>";

  if (item.modifiers && item.modifiers.length > 0) {
    o += "<Requirements>";
    for (var i = 0; i < item.modifiers.length; i++) {
      var mod = item.modifiers[i];
      o += "<Requirement>";
      if (mod.group) o += "<groupMame>" + X(mod.group) + "</groupMame>";
      o += NT + X(mod.name || mod) + NTC;
      o += "<quantity>1</quantity>";
      o += "<price>" + parseFloat(mod.price || 0).toFixed(2) + "</price>";
      o += "</Requirement>";
    }
    o += "</Requirements>";
  }
  o += "</OrderLineItem>";
  return o;
}

// Build combo: first line = combo deal (with combo price + ID), then each component as its own OrderLineItem at $0
function buildComboItems(item) {
  var o = "";

  // Line 1: The combo deal itself with full price
  o += "<OrderLineItem>";
  o += "<itemName>" + X(item.item_name || "Combo Deal") + "</itemName>";
  if (item.special_instructions) {
    o += "<additionalRequirements>" + X(item.special_instructions) + "</additionalRequirements>";
  }
  if (item.item_id) {
    o += "<foodMenuItemId>" + X(item.item_id) + "</foodMenuItemId>";
  }
  o += "<quantity>1</quantity>";
  o += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  o += "<printKitchen>Y</printKitchen>";

  // Combo components as Requirements (for display under the deal name)
  if (item.components && item.components.length > 0) {
    o += "<Requirements>";
    for (var c = 0; c < item.components.length; c++) {
      var comp = item.components[c];
      // Component header
      o += "<Requirement>";
      o += "<groupMame>" + X(comp.component_name) + "</groupMame>";
      o += NT + X(comp.component_name) + NTC;
      o += "<quantity>1</quantity>";
      o += "<price>0.00</price>";
      o += "</Requirement>";
      // Component special request
      if (comp.special_instructions) {
        o += "<Requirement>";
        o += "<groupMame>Special Request</groupMame>";
        o += NT + X(comp.special_instructions) + NTC;
        o += "<quantity>1</quantity>";
        o += "<price>0.00</price>";
        o += "</Requirement>";
      }
      // Component modifiers
      if (comp.modifiers && comp.modifiers.length > 0) {
        for (var m = 0; m < comp.modifiers.length; m++) {
          var mod = comp.modifiers[m];
          o += "<Requirement>";
          if (mod.group) o += "<groupMame>" + X(mod.group) + "</groupMame>";
          o += NT + X(mod.name) + NTC;
          o += "<quantity>1</quantity>";
          o += "<price>" + parseFloat(mod.price || 0).toFixed(2) + "</price>";
          o += "</Requirement>";
        }
      }
    }
    o += "</Requirements>";
  }
  o += "</OrderLineItem>";

  // Lines 2+: Each component as its own OrderLineItem at $0 with its own foodMenuItemId (for POS editing)
  if (item.components && item.components.length > 0) {
    for (var c2 = 0; c2 < item.components.length; c2++) {
      var comp2 = item.components[c2];
      if (!comp2.item_id) continue; // Only add if component has an item_id

      o += "<OrderLineItem>";
      o += "<itemName>" + X(comp2.component_name) + "</itemName>";
      if (comp2.special_instructions) {
        o += "<additionalRequirements>" + X(comp2.special_instructions) + "</additionalRequirements>";
      }
      o += "<foodMenuItemId>" + X(comp2.item_id) + "</foodMenuItemId>";
      o += "<quantity>1</quantity>";
      o += "<unitPrice>0.00</unitPrice>";
      o += "<printKitchen>Y</printKitchen>";

      if (comp2.modifiers && comp2.modifiers.length > 0) {
        o += "<Requirements>";
        for (var m2 = 0; m2 < comp2.modifiers.length; m2++) {
          var mod2 = comp2.modifiers[m2];
          o += "<Requirement>";
          if (mod2.group) o += "<groupMame>" + X(mod2.group) + "</groupMame>";
          o += NT + X(mod2.name) + NTC;
          o += "<quantity>1</quantity>";
          o += "<price>" + parseFloat(mod2.price || 0).toFixed(2) + "</price>";
          o += "</Requirement>";
        }
        o += "</Requirements>";
      }
      o += "</OrderLineItem>";
    }
  }

  return o;
}

function buildXml(order) {
  var ref = genRef();
  var sub = parseFloat(order.subtotal || 0);
  var tax = parseFloat(order.tax || (sub * CONFIG.TAX_RATE));
  var del = order.order_type === "delivery" ? CONFIG.DELIVERY_FEE : 0;
  var tot = parseFloat(order.total || (sub + tax + del));
  var type = order.order_type === "delivery" ? "Delivery" : "Pick-Up";
  var nm = (order.customer_name || "Guest").trim().split(/\s+/);
  var ph = (order.customer_phone || "0000000000").replace(/\D/g, "");

  var o = "<FoodOrder>";
  o += "<referenceNumber>" + ref + "</referenceNumber>";
  o += "<timeString>" + timeNow() + "</timeString>";
  o += "<type>" + type + "</type>";
  o += "<comments>" + X(order.special_instructions || order.comments || "") + "</comments>";
  o += "<payment>" + X(order.payment_method === "card" ? "CREDIT CARD" : "CASH") + "</payment>";
  o += "<subtotal>" + sub.toFixed(2) + "</subtotal>";
  o += "<tax>" + tax.toFixed(2) + "</tax>";
  o += "<total>" + tot.toFixed(2) + "</total>";
  if (del > 0) o += "<deliveryCharge>" + del.toFixed(2) + "</deliveryCharge>";
  o += "<Customer>";
  o += "<firstName>" + X(nm[0] || "Guest") + "</firstName>";
  o += "<lastName>" + X(nm.slice(1).join(" ") || "Order") + "</lastName>";
  o += "<phoneAreaCode>" + ph.substring(0, 3) + "</phoneAreaCode>";
  o += "<phone>" + ph.substring(3) + "</phone>";
  o += "<email>order@aivoice.com</email>";
  if (order.order_type === "delivery" && order.delivery_address) {
    // Parse address parts: "123 Main St, Baltimore, MD 21223"
    var addrRaw = order.delivery_address || "";
    var addrParts = addrRaw.split(",").map(function(s) { return s.trim(); });
    var street1 = addrParts[0] || addrRaw;
    var city = addrParts[1] || order.delivery_city || "";
    var stateZip = (addrParts[2] || "").trim().split(/\s+/);
    var state = order.delivery_state || stateZip[0] || "";
    var zip = order.delivery_zip || stateZip[1] || (addrParts[3] || "").trim();
    o += "<Address>";
    o += "<addressLine1>" + X(street1) + "</addressLine1>";
    o += "<addressLine2></addressLine2>";
    o += "<city>" + X(city) + "</city>";
    o += "<state>" + X(state) + "</state>";
    o += "<zip>" + X(zip) + "</zip>";
    o += "</Address>";
  }
  o += "</Customer>";
  o += "<Items>";
  if (order.items && order.items.length > 0) {
    for (var i = 0; i < order.items.length; i++) {
      var item = order.items[i];
      if (item.is_combo && item.components && item.components.length > 0) {
        o += buildComboItems(item);
      } else {
        o += buildRegularItem(item);
      }
    }
  }
  o += "</Items></FoodOrder>";
  return { xml: o, ref: ref };
}

async function sendToPOS(xml) {
  var url = CONFIG.SUPERMENU_URL + "?id=" + CONFIG.RESTAURANT_ID + "&password=" + CONFIG.PASSWORD;
  var last = "";
  var types = ["text/xml; charset=utf-8", "application/xml; charset=utf-8", "application/x-www-form-urlencoded"];
  for (var a = 0; a < types.length; a++) {
    try {
      var body = a === 2 ? "xml=" + encodeURIComponent(xml) : xml;
      var r = await fetch(url, { method: "POST", headers: { "Content-Type": types[a] }, body: body });
      var t = await r.text();
      last = "attempt" + (a + 1) + " status=" + r.status + " body=" + t;
      console.log("POS " + last);
      if (t.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t };
    } catch (e) { last = "attempt" + (a + 1) + " error=" + e.message; console.log("POS " + last); }
  }
  return { ok: false, response: last };
}

var orderLog = [];

app.post("/retell/function/submit_order", async function (req, res) {
  var log = { time: new Date().toISOString() };
  try {
    var data = req.body.args || req.body;

    // AUTO-EXTRACT caller phone from Retell call object
    var callObj = req.body.call || {};
    var callerPhone = callObj.from_number || callObj.caller_number || callObj.user_phone || "";
    // Clean: remove +1 country code prefix if present
    callerPhone = callerPhone.replace(/^\+1/, "").replace(/\D/g, "");

    // Use caller ID as customer phone if agent didn't collect one
    if (!data.customer_phone || data.customer_phone === "0000000000" || data.customer_phone === "") {
      data.customer_phone = callerPhone;
    }

    log.caller_phone_from_retell = callerPhone;
    log.args = data;
    console.log("\n=== RETELL ORDER ===");
    console.log("Caller Phone (auto):", callerPhone);
    console.log(JSON.stringify(data, null, 2));
    var built = buildXml(data);
    log.xml = built.xml;
    log.ref = built.ref;
    console.log("\n=== XML ===\n" + built.xml);
    var result = await sendToPOS(built.xml);
    log.pos = result;
    log.status = result.ok ? "OK" : "FAIL";
    res.json(result.ok ? "Order placed! Ref " + built.ref + ". " + result.response : "Order ref " + built.ref + ". POS: " + result.response);
  } catch (e) {
    log.status = "ERROR"; log.error = e.message;
    console.error("ERROR:", e);
    res.json("Order noted. Staff will process shortly.");
  }
  orderLog.unshift(log); if (orderLog.length > 10) orderLog.pop();
});

// ═══════════════════════════════════════════════════
// ROUTE: Process card payment (USAePay REST API)
// ═══════════════════════════════════════════════════
var crypto = require("crypto");

function usaepayAuth() {
  var key = process.env.USAEPAY_KEY || "";
  var pin = process.env.USAEPAY_PIN || "";
  if (!key || !pin) return null;
  var seed = crypto.randomBytes(16).toString("hex");
  var prehash = key + seed + pin;
  var hash = crypto.createHash("sha256").update(prehash).digest("hex");
  var apiHash = "s2/" + seed + "/" + hash;
  return "Basic " + Buffer.from(key + ":" + apiHash).toString("base64");
}

var USAEPAY_URL = process.env.USAEPAY_URL || "https://sandbox.usaepay.com/api/v2";

app.post("/retell/function/process_payment", async function (req, res) {
  try {
    var data = req.body.args || req.body;
    console.log("\n=== PROCESS PAYMENT ===");
    console.log(JSON.stringify(data, null, 2));

    var auth = usaepayAuth();
    if (!auth) {
      return res.json("ERROR: Payment system not configured. Please pay cash at pickup/delivery.");
    }

    // Clean card number (remove spaces/dashes from voice transcription)
    var cardNum = (data.card_number || "").replace(/[\s\-]/g, "");
    var exp = (data.expiration || "").replace(/[\s\/\-]/g, "");
    // Convert "1228" or "122028" to "1228" (MMYY)
    if (exp.length === 6) exp = exp.substring(0, 2) + exp.substring(4, 6);
    var cvv = (data.cvv || "").replace(/\D/g, "");
    var zip = (data.zip || "").replace(/\D/g, "");
    var amount = parseFloat(data.amount || 0).toFixed(2);
    var invoice = data.invoice || "ORD-" + Date.now();

    // Validate
    if (cardNum.length < 13 || cardNum.length > 19) return res.json("ERROR: Invalid card number. Please ask for the card number again.");
    if (exp.length !== 4) return res.json("ERROR: Invalid expiration. Need month and year like 12/28.");
    if (cvv.length < 3 || cvv.length > 4) return res.json("ERROR: Invalid CVV. Need the 3 or 4 digit code on the back of the card.");
    if (parseFloat(amount) <= 0) return res.json("ERROR: Invalid amount.");

    var body = {
      command: "sale",
      amount: amount,
      invoice: invoice,
      creditcard: {
        number: cardNum,
        expiration: exp,
        cvc: cvv,
        avs_zip: zip,
      },
    };

    console.log("USAePay request:", JSON.stringify({ ...body, creditcard: { ...body.creditcard, number: "****" + cardNum.slice(-4), cvc: "***" } }));

    var r = await fetch(USAEPAY_URL + "/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body),
    });

    var result = await r.json();
    console.log("USAePay response:", JSON.stringify(result));

    if (result.result_code === "A") {
      return res.json("SUCCESS: Payment approved. Auth code: " + (result.authcode || "") + ". Ref: " + (result.refnum || "") + ". Last 4: " + cardNum.slice(-4));
    } else if (result.result_code === "D") {
      return res.json("DECLINED: " + (result.result || "Card declined") + ". Ask if they want to try another card or pay cash.");
    } else if (result.result_code === "E") {
      return res.json("ERROR: " + (result.error || result.result || "Processing error") + ". Ask to try again or pay cash.");
    } else {
      return res.json("ERROR: " + (result.result || "Unknown error") + ". Suggest cash payment.");
    }
  } catch (e) {
    console.error("Payment error:", e);
    return res.json("ERROR: Payment system unavailable. Please pay cash at pickup/delivery.");
  }
});

// Test payment endpoint (uses sandbox test card)
app.get("/test-payment", async function (req, res) {
  var auth = usaepayAuth();
  if (!auth) return res.json({ error: "Set USAEPAY_KEY and USAEPAY_PIN in Render env vars" });

  var body = {
    command: "sale",
    amount: "1.00",
    invoice: "TEST-" + Date.now(),
    creditcard: { number: "4000100011112224", expiration: "0928", cvc: "123", avs_zip: "21223" },
  };

  try {
    var r = await fetch(USAEPAY_URL + "/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body),
    });
    var result = await r.json();
    res.json({ version: "V15", usaepay_url: USAEPAY_URL, result: result });
  } catch (e) { res.json({ error: e.message }); }
});

app.post("/retell/function/verify_address", async function (req, res) {
  try {
    var data = req.body.args || req.body;
    var addr = data.address;
    console.log("\n=== VERIFY ADDRESS ===");
    console.log("Input:", addr);

    if (!addr || addr.trim().length < 3) return res.json("INVALID: No address provided. Ask for full delivery address.");
    if (!CONFIG.GOOGLE_MAPS_API_KEY) return res.json("FOUND: Address accepted. " + addr);

    // Try multiple variations to find the address
    var variations = [
      addr,                                    // as-is
      addr.replace(/\s+/g, " ").trim(),       // clean whitespace
    ];

    // If address doesn't seem to have a city, try adding common ones from restaurant area
    var hasComma = addr.indexOf(",") !== -1;
    var lowerAddr = addr.toLowerCase();
    if (!hasComma && lowerAddr.indexOf("il") === -1 && lowerAddr.indexOf("illinois") === -1 && lowerAddr.indexOf("chicago") === -1 && lowerAddr.indexOf("va") === -1 && lowerAddr.indexOf("virginia") === -1) {
      // Try appending city based on restaurant location
      if (CONFIG.RESTAURANT_LAT > 41 && CONFIG.RESTAURANT_LAT < 43) {
        variations.push(addr + ", Chicago, IL");
        variations.push(addr + ", IL");
      } else if (CONFIG.RESTAURANT_LAT > 38 && CONFIG.RESTAURANT_LAT < 40) {
        variations.push(addr + ", Reston, VA");
        variations.push(addr + ", VA");
      }
      // Generic: just try with USA
      variations.push(addr + ", USA");
    }

    console.log("Trying variations:", variations);

    for (var v = 0; v < variations.length; v++) {
      try {
        var r = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(variations[v]) + "&key=" + CONFIG.GOOGLE_MAPS_API_KEY);
        var geo = await r.json();
        console.log("Variation " + (v+1) + " (" + variations[v] + "): " + geo.status + " results=" + (geo.results ? geo.results.length : 0));

        if (geo.status === "OK" && geo.results && geo.results.length > 0) {
          var place = geo.results[0];
          var fmt = place.formatted_address;
          var loc = place.geometry.location;

          // Check delivery distance
          if (CONFIG.RESTAURANT_LAT !== 0) {
            var R = 3958.8;
            var dLat = ((loc.lat - CONFIG.RESTAURANT_LAT) * Math.PI) / 180;
            var dLng = ((loc.lng - CONFIG.RESTAURANT_LNG) * Math.PI) / 180;
            var a2 = Math.sin(dLat / 2) ** 2 + Math.cos(CONFIG.RESTAURANT_LAT * Math.PI / 180) * Math.cos(loc.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            var dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2)) * 10) / 10;
            if (dist > CONFIG.MAX_DELIVERY_MILES) {
              return res.json("OUT_OF_RANGE: " + dist + " miles away. Maximum delivery distance is " + CONFIG.MAX_DELIVERY_MILES + " miles. Address: " + fmt);
            }
          }

          // Check if it has a street number (specific address, not just a city)
          var hasNum = place.address_components && place.address_components.some(function (c) { return c.types.indexOf("street_number") !== -1; });
          if (!hasNum) {
            // Found a general area but not specific — keep trying other variations
            if (v < variations.length - 1) continue;
            return res.json("PARTIAL: Found general area but not exact address: " + fmt + ". Ask for house or building number.");
          }

          return res.json("FOUND: " + fmt);
        }
      } catch (e) { console.log("Variation " + (v+1) + " error:", e.message); }
    }

    return res.json("NOT_FOUND: Could not find this address. Ask the customer to spell the street name and include the city.");
  } catch (e) {
    console.error("Address verify error:", e);
    return res.json("FOUND: Address accepted (verification unavailable). " + ((req.body.args && req.body.args.address) || ""));
  }
});

app.get("/debug", function (req, res) { res.json({ total: orderLog.length, orders: orderLog }); });

app.get("/test-order", async function (req, res) {
  var order = { order_type: "pickup", customer_name: "Test Regular", customer_phone: "8888888888",
    items: [{ item_name: '14" Large Cheese Pizza', item_id: "737", quantity: 1, unit_price: 11.99, modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }] }],
    subtotal: 13.99, tax: 0.84, total: 14.83 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V15", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-combo", async function (req, res) {
  var order = { order_type: "pickup", customer_name: "Test Combo", customer_phone: "8888888888",
    items: [{ item_name: '12"PIZZA W/1 TOP 8"SUB, 6 BUFFALO WING and 2 CAN OF SODA', item_id: "769", quantity: 1, unit_price: 29.99, is_combo: true,
      components: [
        { component_name: '12" Cheese Pizza', item_id: "736", modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 0 }] },
        { component_name: 'CHEESE STEAK SUB', item_id: "684", modifiers: [{ group: "Sub Fixins", name: "Everything", price: 0 }, { group: "Cheese Options", name: "American", price: 0 }] },
        { component_name: "6pcs Buffalo wings", item_id: "579", modifiers: [{ group: "Wings - Flavors", name: "Hot", price: 0 }, { group: "Wings - Dressing", name: "Ranch", price: 0 }] },
        { component_name: "Soda", item_id: "728", modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
        { component_name: "Soda", item_id: "728", modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] }
      ] }],
    subtotal: 29.99, tax: 1.80, total: 31.79 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V15", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-delivery", async function (req, res) {
  var order = { order_type: "delivery", customer_name: "Test Delivery", customer_phone: "4105551234",
    delivery_address: "2755 Edmondson Ave, Baltimore, MD 21223",
    items: [{ item_name: '14" Large Cheese Pizza', item_id: "737", quantity: 1, unit_price: 11.99, modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }] }],
    subtotal: 13.99, tax: 0.84, total: 16.78 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V15", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/raw-xml", function (req, res) {
  var order = { order_type: "pickup", customer_name: "Raw Test", customer_phone: "8888888888",
    items: [{ item_name: 'Test Pizza', quantity: 1, unit_price: 11.99, modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }] }],
    subtotal: 13.99, tax: 0.84, total: 14.83 };
  var built = buildXml(order);
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send(built.xml);
});

app.get("/raw-lastorder", function (req, res) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  if (orderLog.length > 0 && orderLog[0].xml) { res.send(orderLog[0].xml); } else { res.send("No orders yet"); }
});

app.get("/tag-test", function (req, res) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("NT variable resolves to: [" + NT + "]\nNTC variable resolves to: [" + NTC + "]\nSample: " + NT + "Pepperoni" + NTC);
});

// TEST ADDRESS: visit /test-address?q=123+Main+St+Chicago+IL
app.get("/test-address", async function (req, res) {
  var addr = req.query.q || req.query.address || "";
  if (!addr) return res.json({ error: "Add ?q=your+address to the URL. Example: /test-address?q=123+Main+St+Chicago+IL" });
  // Simulate what Retell sends
  var fakeReq = { body: { args: { address: addr } } };
  var fakeRes = { json: function (result) { res.json({ input: addr, result: result, has_api_key: !!CONFIG.GOOGLE_MAPS_API_KEY }); } };
  // Call the real verify function
  app.handle({ method: "POST", url: "/retell/function/verify_address", headers: { "content-type": "application/json" }, body: JSON.stringify({ args: { address: addr } }) }, fakeRes);
});

// Simpler test-address that calls Google directly
app.get("/test-address2", async function (req, res) {
  var addr = req.query.q || "";
  if (!addr) return res.json({ error: "Add ?q=your+address. Example: /test-address2?q=123+Main+St+Chicago+IL" });
  if (!CONFIG.GOOGLE_MAPS_API_KEY) return res.json({ error: "No GOOGLE_MAPS_API_KEY set in environment" });
  try {
    var r = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(addr) + "&key=" + CONFIG.GOOGLE_MAPS_API_KEY);
    var geo = await r.json();
    res.json({ input: addr, status: geo.status, results_count: geo.results ? geo.results.length : 0, results: geo.results || [], error_message: geo.error_message || null });
  } catch (e) { res.json({ error: e.message }); }
});

app.get("/", function (req, res) {
  res.json({ status: "running", version: "V15", restaurant_id: CONFIG.RESTAURANT_ID,
    has_payment: !!process.env.USAEPAY_KEY,
    endpoints: ["POST /retell/function/submit_order", "POST /retell/function/verify_address", "POST /retell/function/process_payment",
      "GET /test-order", "GET /test-combo", "GET /test-delivery", "GET /test-payment", "GET /test-address2?q=ADDRESS", "GET /debug"] });
});

app.listen(CONFIG.PORT, function () { console.log("V15 POS Bridge | Port: " + CONFIG.PORT + " | ID: " + CONFIG.RESTAURANT_ID); });
