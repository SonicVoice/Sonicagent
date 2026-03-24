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
  if (item.item_id && /^\d+$/.test(String(item.item_id))) {
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
// OLD combo function removed — combos now handled as individual items + discount line in buildXml

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
    // Parse address parts: "123 Main St, Baltimore, MD 21223" or just "123 Main St 21223"
    var addrRaw = order.delivery_address || "";
    var addrParts = addrRaw.split(",").map(function(s) { return s.trim(); });
    var street1 = addrParts[0] || addrRaw;
    var city = addrParts[1] || order.delivery_city || process.env.DEFAULT_CITY || "Baltimore";
    var stateZip = (addrParts[2] || "").trim().split(/\s+/);
    var state = order.delivery_state || stateZip[0] || process.env.DEFAULT_STATE || "MD";
    var zip = order.delivery_zip || stateZip[1] || (addrParts[3] || "").trim();
    // If no zip found in parsed parts, try extracting 5-digit zip from raw address
    if (!zip) { var zipMatch = addrRaw.match(/\b(\d{5})\b/); if (zipMatch) zip = zipMatch[1]; }
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
    // ALL items sent as individual regular items at their regular prices
    for (var i = 0; i < order.items.length; i++) {
      o += buildRegularItem(order.items[i]);
    }

    // COMBO DEALS: add a negative discount line for each combo
    if (order.combo_deals && order.combo_deals.length > 0) {
      for (var cd = 0; cd < order.combo_deals.length; cd++) {
        var deal = order.combo_deals[cd];
        var comboPrice = parseFloat(deal.price || deal.combo_price || 0);
        var comboGroup = deal.group;
        var comboName = deal.name || deal.combo_name || "Combo Deal";
        var comboId = deal.id || deal.combo_id || "";

        // Sum up regular prices of items in this combo group
        var regularTotal = 0;
        for (var j = 0; j < order.items.length; j++) {
          var ci = order.items[j];
          if (ci.combo_group == comboGroup) {
            regularTotal += parseFloat(ci.unit_price || ci.price || 0) * (ci.quantity || 1);
            // Add modifier prices
            if (ci.modifiers && ci.modifiers.length > 0) {
              for (var k = 0; k < ci.modifiers.length; k++) {
                regularTotal += parseFloat(ci.modifiers[k].price || 0);
              }
            }
          }
        }

        // Discount = regular total - combo price (should be positive)
        var discount = Math.round((regularTotal - comboPrice) * 100) / 100;

        if (discount > 0) {
          o += "<OrderLineItem>";
          o += "<itemName>" + X(comboName + " Discount") + "</itemName>";
          if (comboId && /^\d+$/.test(String(comboId))) {
            o += "<foodMenuItemId>" + X(comboId) + "</foodMenuItemId>";
          }
          o += "<quantity>1</quantity>";
          o += "<unitPrice>-" + discount.toFixed(2) + "</unitPrice>";
          o += "<printKitchen>N</printKitchen>";
          o += "</OrderLineItem>";
        }

        console.log("COMBO: " + comboName + " | Regular: $" + regularTotal.toFixed(2) + " | Combo: $" + comboPrice.toFixed(2) + " | Discount: -$" + discount.toFixed(2));
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

// ═══════════════════════════════════════════════════
// ROUTE: Get caller ID (returns phone number to agent)
// ═══════════════════════════════════════════════════
app.post("/retell/function/get_caller_id", function (req, res) {
  var callObj = req.body.call || {};
  var phone = callObj.from_number || callObj.caller_number || callObj.user_phone || "";
  phone = phone.replace(/^\+1/, "").replace(/\D/g, "");
  console.log("\n=== GET CALLER ID ===");
  console.log("Raw call object keys:", Object.keys(callObj).join(", "));
  console.log("Extracted phone:", phone);
  if (phone.length === 10) {
    var formatted = "(" + phone.substring(0, 3) + ") " + phone.substring(3, 6) + "-" + phone.substring(6);
    res.json("PHONE: " + formatted);
  } else if (phone.length > 0) {
    res.json("PHONE: " + phone);
  } else {
    res.json("NO_PHONE: Could not detect caller ID. Ask the caller for their phone number.");
  }
});

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

    // BUILD ITEM SUMMARY for easy verification
    var itemSummary = [];
    if (data.items && data.items.length > 0) {
      for (var s = 0; s < data.items.length; s++) {
        var si = data.items[s];
        var entry = {
          name: si.item_name || si.name || "?",
          id: si.item_id || "none",
          qty: si.quantity || 1,
          price: si.unit_price || si.price || 0,
          is_combo: !!si.is_combo,
          modifiers: [],
          components: [],
        };
        if (si.modifiers) {
          for (var sm = 0; sm < si.modifiers.length; sm++) {
            entry.modifiers.push((si.modifiers[sm].group || "") + ": " + (si.modifiers[sm].name || ""));
          }
        }
        if (si.is_combo && si.components) {
          for (var sc = 0; sc < si.components.length; sc++) {
            var comp = si.components[sc];
            var compEntry = { name: comp.component_name || "?", id: comp.item_id || "none", modifiers: [] };
            if (comp.modifiers) {
              for (var cm = 0; cm < comp.modifiers.length; cm++) {
                compEntry.modifiers.push((comp.modifiers[cm].group || "") + ": " + (comp.modifiers[cm].name || ""));
              }
            }
            entry.components.push(compEntry);
          }
        }
        itemSummary.push(entry);
      }
    }
    log.item_count = itemSummary.length;
    log.item_summary = itemSummary;
    log.payment_method = data.payment_method || "cash";
    log.customer_name = data.customer_name || "?";
    log.order_type = data.order_type || "?";
    log.total = data.total || 0;

    console.log("\n=== RETELL ORDER ===");
    console.log("Caller Phone (auto):", callerPhone);
    console.log("Items:", itemSummary.length);
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
  orderLog.unshift(log); if (orderLog.length > 50) orderLog.pop();
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
var paymentLog = [];

app.post("/retell/function/process_payment", async function (req, res) {
  var plog = { time: new Date().toISOString(), last4: "", amount: "", status: "", reason: "", refnum: "", authcode: "", error_code: "" };
  try {
    var data = req.body.args || req.body;
    console.log("\n=== PROCESS PAYMENT ===");
    console.log(JSON.stringify(data, null, 2));

    var auth = usaepayAuth();
    if (!auth) {
      plog.status = "CONFIG_ERROR"; plog.reason = "No API key";
      paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop();
      return res.json("ERROR: Payment system not configured. Please pay cash at pickup/delivery.");
    }

    // Clean card number (remove spaces/dashes from voice transcription)
    var cardNum = (data.card_number || "").replace(/[\s\-\.]/g, "").replace(/[oO]/g, "0");
    var exp = (data.expiration || "").replace(/[\s\/\-\.]/g, "");
    // Handle various formats: "1130" "112030" "11/30" "1130" "11 30"
    if (exp.length === 6) exp = exp.substring(0, 2) + exp.substring(4, 6); // 112030 → 1130
    if (exp.length === 3) exp = "0" + exp; // 130 → 0130
    // Handle "2030" year-first by checking if first 2 digits > 12
    if (exp.length === 4 && parseInt(exp.substring(0, 2)) > 12) {
      exp = exp.substring(2, 4) + exp.substring(0, 2); // swap if year first
    }
    var cvv = (data.cvv || "").replace(/\D/g, "");
    var zip = (data.zip || "").replace(/\D/g, "");
    var amount = parseFloat(data.amount || 0).toFixed(2);
    var invoice = data.invoice || "ORD-" + Date.now();

    plog.last4 = cardNum.slice(-4);
    plog.amount = amount;
    plog.invoice = invoice;

    // Validate
    if (cardNum.length < 13 || cardNum.length > 19) { plog.status = "INVALID"; plog.reason = "Bad card number length: " + cardNum.length; paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop(); return res.json("ERROR: Invalid card number. Please ask for the card number again."); }
    if (exp.length !== 4) { plog.status = "INVALID"; plog.reason = "Bad expiration: " + exp; paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop(); return res.json("ERROR: Invalid expiration. Need month and year like 12/28."); }
    if (cvv.length < 3 || cvv.length > 4) { plog.status = "INVALID"; plog.reason = "Bad CVV length: " + cvv.length; paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop(); return res.json("ERROR: Invalid CVV. Need the 3 or 4 digit code on the back of the card."); }
    if (parseFloat(amount) <= 0) { plog.status = "INVALID"; plog.reason = "Bad amount: " + amount; paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop(); return res.json("ERROR: Invalid amount."); }

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

    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 10000);

    var r = await fetch(USAEPAY_URL + "/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    var result = await r.json();
    console.log("USAePay response:", JSON.stringify(result));

    plog.refnum = result.refnum || "";
    plog.authcode = result.authcode || "";
    plog.error_code = result.error_code || "";
    plog.card_type = (result.creditcard && result.creditcard.type) || "";
    plog.avs = (result.avs && result.avs.result_code) || "";
    plog.cvc_result = (result.cvc && result.cvc.result_code) || "";

    if (result.result_code === "A") {
      plog.status = "APPROVED"; plog.reason = result.result || "Approved";
      paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop();
      return res.json("SUCCESS: Payment approved. Auth code: " + (result.authcode || "") + ". Ref: " + (result.refnum || "") + ". Last 4: " + cardNum.slice(-4));
    } else if (result.result_code === "D") {
      // Map bank error codes to customer-friendly messages
      var errMsg = (result.error || "").toLowerCase();
      var friendly = "your bank declined the card";
      if (errMsg.indexOf("insufficient") !== -1 || errMsg.indexOf("(51)") !== -1) friendly = "there are insufficient funds on the card";
      else if (errMsg.indexOf("expired") !== -1 || errMsg.indexOf("(54)") !== -1) friendly = "the card appears to be expired";
      else if (errMsg.indexOf("invalid") !== -1 || errMsg.indexOf("(14)") !== -1) friendly = "the card number doesn't seem to be valid";
      else if (errMsg.indexOf("restricted") !== -1 || errMsg.indexOf("(62)") !== -1) friendly = "the card is restricted by your bank";
      else if (errMsg.indexOf("do not honor") !== -1 || errMsg.indexOf("(05)") !== -1) friendly = "your bank declined the transaction";
      else if (errMsg.indexOf("not entitled") !== -1 || errMsg.indexOf("(63)") !== -1) friendly = "the card is not authorized for this type of transaction";
      else if (errMsg.indexOf("lost") !== -1 || errMsg.indexOf("(41)") !== -1) friendly = "the card has been reported lost";
      else if (errMsg.indexOf("stolen") !== -1 || errMsg.indexOf("(43)") !== -1) friendly = "the card has been reported stolen";
      else if (errMsg.indexOf("limit") !== -1 || errMsg.indexOf("exceed") !== -1) friendly = "the card has exceeded its limit";
      else if (errMsg.indexOf("pin") !== -1) friendly = "there's a PIN issue with the card";
      else if (errMsg.indexOf("cvv") !== -1 || errMsg.indexOf("cvc") !== -1 || errMsg.indexOf("(97)") !== -1) friendly = "the security code doesn't match";

      plog.status = "DECLINED"; plog.reason = result.error || result.result || "Declined";
      paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop();
      return res.json("DECLINED: Tell the caller: " + friendly + ". Then ask: would you like to try another card or pay cash?");
    } else if (result.result_code === "E") {
      plog.status = "ERROR"; plog.reason = result.error || result.result || "Error";
      paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop();
      return res.json("ERROR: " + (result.error || result.result || "Processing error") + ". Ask to try again or pay cash.");
    } else {
      plog.status = "UNKNOWN"; plog.reason = result.error || result.result || "Unknown";
      paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop();
      return res.json("ERROR: " + (result.result || "Unknown error") + ". Suggest cash payment.");
    }
  } catch (e) {
    plog.status = "EXCEPTION"; plog.reason = e.message;
    paymentLog.unshift(plog); if (paymentLog.length > 20) paymentLog.pop();
    console.error("Payment error:", e);
    return res.json("ERROR: Payment system unavailable. Please pay cash at pickup/delivery.");
  }
});

// Payment log viewer
app.get("/payment-log", function (req, res) {
  res.json({ total: paymentLog.length, payments: paymentLog });
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

    if (!addr || addr.trim().length < 3) return res.json("INVALID: No address provided. Ask for street address and zip.");
    if (!CONFIG.GOOGLE_MAPS_API_KEY) return res.json("FOUND: Address accepted. " + addr);

    // Default city/state from env vars
    var defaultCity = process.env.DEFAULT_CITY || "Baltimore";
    var defaultState = process.env.DEFAULT_STATE || "MD";
    var clean = addr.replace(/\s+/g, " ").trim();

    // Build ONE smart query — always append city/state if not present
    var query = clean;
    if (clean.toLowerCase().indexOf(defaultCity.toLowerCase()) === -1) {
      query = clean + ", " + defaultCity + ", " + defaultState;
    }

    console.log("Address query:", query);

    try {
      var r = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(query) + "&key=" + CONFIG.GOOGLE_MAPS_API_KEY);
      var geo = await r.json();

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
            return res.json("OUT_OF_RANGE: " + dist + " miles away. Max " + CONFIG.MAX_DELIVERY_MILES + " miles. Address: " + fmt);
          }
        }

        var hasNum = place.address_components && place.address_components.some(function (c) { return c.types.indexOf("street_number") !== -1; });
        if (!hasNum) {
          return res.json("PARTIAL: Found area but not exact: " + fmt + ". Ask for house number.");
        }

        return res.json("FOUND: " + fmt);
      }

      return res.json("NOT_FOUND: Could not find address. Ask to spell street name.");
    } catch (e) {
      console.log("Geocode error:", e.message);
      return res.json("FOUND: Address accepted. " + clean);
    }
  } catch (e) {
    return res.json("FOUND: Address accepted. " + ((req.body.args && req.body.args.address) || ""));
  }
});

app.get("/debug", function (req, res) { res.json({ total: orderLog.length, orders: orderLog }); });

// ═══════════════════════════════════════════════════
// CLEAN ORDER VIEWER — easy to read receipts
// ═══════════════════════════════════════════════════
app.get("/orders", function (req, res) {
  var receipts = orderLog.map(function (o) {
    return {
      time: o.time,
      ref: o.ref,
      status: o.status,
      customer: o.customer_name || "?",
      phone: o.caller_phone_from_retell || "?",
      type: o.order_type || "?",
      payment: o.payment_method || "?",
      item_count: o.item_count || 0,
      items: o.item_summary || [],
      total: o.total || 0,
    };
  });
  res.json({ total: receipts.length, orders: receipts });
});

// Single order receipt by ref number
app.get("/order/:ref", function (req, res) {
  var ref = req.params.ref;
  var found = null;
  for (var i = 0; i < orderLog.length; i++) {
    if (String(orderLog[i].ref) === String(ref)) { found = orderLog[i]; break; }
  }
  if (!found) return res.json({ error: "Order " + ref + " not found in last 10 orders." });

  var receipt = "═══════════════════════════════════════\n";
  receipt += "  ORDER #" + found.ref + "\n";
  receipt += "  " + (found.time || "") + "\n";
  receipt += "═══════════════════════════════════════\n";
  receipt += "Customer: " + (found.customer_name || "?") + "\n";
  receipt += "Phone: " + (found.caller_phone_from_retell || "none") + "\n";
  receipt += "Type: " + (found.order_type || "?") + "\n";
  receipt += "Payment: " + (found.payment_method || "?") + "\n";
  receipt += "Status: " + (found.status || "?") + "\n";
  receipt += "───────────────────────────────────────\n";
  receipt += "ITEMS (" + (found.item_count || 0) + "):\n";

  var summary = found.item_summary || [];
  for (var j = 0; j < summary.length; j++) {
    var item = summary[j];
    receipt += "\n  " + item.qty + "x " + item.name + " $" + parseFloat(item.price).toFixed(2);
    receipt += " [ID:" + item.id + "]";
    if (item.is_combo) receipt += " (COMBO)";
    receipt += "\n";
    for (var m = 0; m < item.modifiers.length; m++) {
      receipt += "     → " + item.modifiers[m] + "\n";
    }
    for (var c = 0; c < item.components.length; c++) {
      var comp = item.components[c];
      receipt += "     ● " + comp.name + " [ID:" + comp.id + "]\n";
      for (var cm = 0; cm < comp.modifiers.length; cm++) {
        receipt += "       → " + comp.modifiers[cm] + "\n";
      }
    }
  }

  receipt += "───────────────────────────────────────\n";
  receipt += "Total: $" + parseFloat(found.total || 0).toFixed(2) + "\n";
  receipt += "═══════════════════════════════════════\n";

  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send(receipt);
});

app.get("/test-order", async function (req, res) {
  var order = { order_type: "pickup", customer_name: "Test Regular", customer_phone: "8888888888",
    items: [{ item_name: '14" Large Cheese Pizza', item_id: "737", quantity: 1, unit_price: 11.99, modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }] }],
    subtotal: 13.99, tax: 0.84, total: 14.83 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V15", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-combo", async function (req, res) {
  // Combo Deal: 12" pizza(1top) + 8" sub + 6 wings + 2 cans = $29.99 [769]
  // Each item at regular price, server adds discount line
  var order = { order_type: "pickup", customer_name: "Test Combo", customer_phone: "8888888888",
    items: [
      { item_name: '12" Cheese Pizza', item_id: "736", quantity: 1, unit_price: 10.99, combo_group: 1,
        modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 1.50 }] },
      { item_name: 'CHEESE STEAK SUB', item_id: "684", quantity: 1, unit_price: 8.49, combo_group: 1,
        modifiers: [{ group: "Sub Fixins", name: "Everything", price: 0 }, { group: "Cheese Options", name: "American", price: 0 }] },
      { item_name: '6pcs Buffalo wings', item_id: "579", quantity: 1, unit_price: 8.99, combo_group: 1,
        modifiers: [{ group: "Wings - Flavors", name: "Hot", price: 0 }, { group: "Wings - Dressing", name: "Ranch", price: 0 }] },
      { item_name: 'Soda', item_id: "728", quantity: 1, unit_price: 1.00, combo_group: 1,
        modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
      { item_name: 'Soda', item_id: "728", quantity: 1, unit_price: 1.00, combo_group: 1,
        modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
    ],
    combo_deals: [
      { group: 1, name: "Combo Deal 12\" Pizza+Sub+Wings+2Cans", id: "769", price: 29.99 }
    ],
    subtotal: 29.99, tax: 1.80, total: 31.79 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V16", xml: built.xml, pos: result, ref: built.ref });
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
    endpoints: ["POST /retell/function/submit_order", "POST /retell/function/verify_address", "POST /retell/function/process_payment", "POST /retell/function/get_caller_id",
      "GET /orders (clean receipt list)", "GET /order/:ref (single receipt)", "GET /payment-log",
      "GET /test-order", "GET /test-combo", "GET /test-delivery", "GET /test-payment", "GET /debug"] });
});

app.listen(CONFIG.PORT, function () { console.log("V15 POS Bridge | Port: " + CONFIG.PORT + " | ID: " + CONFIG.RESTAURANT_ID); });
