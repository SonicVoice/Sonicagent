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
  RESTAURANT_LAT: parseFloat(process.env.RESTAURANT_LAT || "38.9687"),
  RESTAURANT_LNG: parseFloat(process.env.RESTAURANT_LNG || "-77.3411"),
  MAX_DELIVERY_MILES: parseFloat(process.env.MAX_DELIVERY_MILES || "4"),
  TAX_RATE: 0.06,
  DELIVERY_FEE: 1.95,
  PORT: process.env.PORT || 3000,
};

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
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
  return y + "/" + mo + "/" + d + " " + h + ":" + mi + ":" + s;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════
// TOPPING PRICING — first topping FREE in combos
// ═══════════════════════════════════════════════════
const TOPPING_PRICE_BY_SIZE = {
  '10': 1.00, 'small': 1.00, 'personal': 1.00,
  '12': 1.50, 'medium': 1.50, 'med': 1.50,
  '14': 2.00, 'large': 2.00, 'lrg': 2.00,
  '16': 2.50, 'x-large': 2.50, 'xlarge': 2.50, 'xl': 2.50,
  '18': 3.00, 'xx-large': 3.00, 'xxl': 3.00,
};

function getToppingPrice(componentName) {
  var lower = (componentName || "").toLowerCase();
  for (var key in TOPPING_PRICE_BY_SIZE) {
    if (lower.indexOf(key) !== -1) return TOPPING_PRICE_BY_SIZE[key];
  }
  return 2.00;
}

function isPizzaComponent(cname) {
  var lower = (cname || "").toLowerCase();
  return lower.indexOf("pizza") !== -1 || lower.indexOf("cheese") !== -1;
}

// ═══════════════════════════════════════════════════
// BUILD XML — single line item
// ═══════════════════════════════════════════════════
function buildOrderLineItem(item) {
  var x = "<OrderLineItem>";
  x += "<itemName>" + esc(item.item_name || item.name || "Item") + "</itemName>";

  // Item-level special request → additionalRequirements (BLUE in POS)
  if (item.special_instructions) {
    x += "<additionalRequirements>" + esc(item.special_instructions) + "</additionalRequirements>";
  }

  x += "<quantity>" + (item.quantity || 1) + "</quantity>";
  x += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  x += "<printKitchen>Y</printKitchen>";

  // ═══ COMBO: each component listed individually ═══
  if (item.is_combo && item.components && item.components.length > 0) {
    x += "<Requirements>";

    for (var c = 0; c < item.components.length; c++) {
      var comp = item.components[c];

      // Component header in RED (e.g., "14 inch Cheese Pizza:")
      x += "<Requirement>";
      x += "<groupMame>" + esc(comp.component_name) + "</groupMame>";
      x += "<name>" + esc(comp.component_name) + "</name>";
      x += "<quantity>1</quantity>";
      x += "<price>0.00</price>";
      x += "</Requirement>";

      // Component special request in BLUE
      if (comp.special_instructions) {
        x += "<Requirement>";
        x += "<groupMame>Special Request</groupMame>";
        x += "<name>" + esc(comp.special_instructions) + "</name>";
        x += "<quantity>1</quantity>";
        x += "<price>0.00</price>";
        x += "</Requirement>";
      }

      // Modifiers in BLACK
      if (comp.modifiers && comp.modifiers.length > 0) {
        var isPizza = isPizzaComponent(comp.component_name);
        var toppingCount = 0;
        var extraToppingPrice = getToppingPrice(comp.component_name);

        // Free first topping ONLY if combo name says "1 top" / "1-top" / "1 topping"
        var comboName = (item.item_name || "").toLowerCase();
        var hasFreeToppingInDeal = comboName.indexOf("1 top") !== -1 || comboName.indexOf("1-top") !== -1 || comboName.indexOf("1 topping") !== -1;

        for (var m = 0; m < comp.modifiers.length; m++) {
          var mod = comp.modifiers[m];
          var modPrice = parseFloat(mod.price || 0);
          var groupLower = (mod.group || "").toLowerCase();
          var isTopping = groupLower.indexOf("topping") !== -1;

          if (isPizza && isTopping && hasFreeToppingInDeal) {
            toppingCount++;
            if (toppingCount <= 1) {
              modPrice = 0; // FREE — included in combo deal
            } else {
              modPrice = extraToppingPrice; // EXTRA — charged by size
            }
          } else if (isPizza && isTopping && !hasFreeToppingInDeal) {
            modPrice = extraToppingPrice; // No free topping in this deal
          }

          x += "<Requirement>";
          x += "<groupMame>" + esc(mod.group || "") + "</groupMame>";
          x += "<name>" + esc(mod.name) + "</name>";
          x += "<quantity>1</quantity>";
          x += "<price>" + modPrice.toFixed(2) + "</price>";
          x += "</Requirement>";
        }
      }
    }

    x += "</Requirements>";
  }
  // ═══ REGULAR ITEM: modifiers as Requirements ═══
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

// ═══════════════════════════════════════════════════
// BUILD FULL XML ORDER
// ═══════════════════════════════════════════════════
function buildOrderXml(orderData) {
  var refNumber = generateReferenceNumber();
  var timeString = getTimeString();
  var subtotal = parseFloat(orderData.subtotal || 0);
  var tax = parseFloat(orderData.tax || (subtotal * CONFIG.TAX_RATE));
  var deliveryCharge = orderData.order_type === "delivery" ? CONFIG.DELIVERY_FEE : 0;
  var total = parseFloat(orderData.total || (subtotal + tax + deliveryCharge));
  var orderType = orderData.order_type === "delivery" ? "Delivery" : "Pick-Up";

  var fullName = orderData.customer_name || "Guest";
  var parts = fullName.trim().split(/\s+/);
  var firstName = parts[0] || "Guest";
  var lastName = parts.slice(1).join(" ") || "Order";
  var phone = (orderData.customer_phone || "0000000000").replace(/\D/g, "");
  var areaCode = phone.substring(0, 3) || "000";
  var phoneNum = phone.substring(3) || "0000000";

  // Order-level special instructions → <comments> (shows as NOTES in POS)
  var comments = orderData.special_instructions || orderData.comments || "";

  var x = "<FoodOrder>";
  x += "<referenceNumber>" + refNumber + "</referenceNumber>";
  x += "<timeString>" + timeString + "</timeString>";
  x += "<type>" + orderType + "</type>";
  x += "<comments>" + esc(comments) + "</comments>";
  x += "<payment>CASH</payment>";
  x += "<subtotal>" + subtotal.toFixed(2) + "</subtotal>";
  x += "<tax>" + tax.toFixed(2) + "</tax>";
  x += "<total>" + total.toFixed(2) + "</total>";
  if (deliveryCharge > 0) x += "<deliveryCharge>" + deliveryCharge.toFixed(2) + "</deliveryCharge>";

  x += "<Customer>";
  x += "<firstName>" + esc(firstName) + "</firstName>";
  x += "<lastName>" + esc(lastName) + "</lastName>";
  x += "<phoneAreaCode>" + areaCode + "</phoneAreaCode>";
  x += "<phone>" + phoneNum + "</phone>";
  x += "<email>order@aivoice.com</email>";
  x += "</Customer>";

  if (orderData.order_type === "delivery" && orderData.delivery_address) {
    x += "<Address>";
    x += "<addressLine1>" + esc(orderData.delivery_address) + "</addressLine1>";
    x += "<addressLine2></addressLine2>";
    x += "<city></city><state></state><zip></zip>";
    x += "</Address>";
  }

  x += "<Items>";
  if (orderData.items && orderData.items.length > 0) {
    for (var i = 0; i < orderData.items.length; i++) {
      x += buildOrderLineItem(orderData.items[i]);
    }
  }
  x += "</Items></FoodOrder>";

  return { xml: x, refNumber: refNumber };
}

// ═══════════════════════════════════════════════════
// SEND TO POS — try multiple content types
// ═══════════════════════════════════════════════════
async function sendToPOS(xml) {
  var url = CONFIG.SUPERMENU_URL + "?id=" + CONFIG.RESTAURANT_ID + "&password=" + CONFIG.PASSWORD;

  // Attempt 1: text/xml
  try {
    var r1 = await fetch(url, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8" }, body: xml });
    var t1 = await r1.text();
    console.log("Attempt 1 (text/xml):", r1.status, t1);
    if (t1.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t1 };
  } catch (e) { console.log("Attempt 1 error:", e.message); }

  // Attempt 2: application/xml
  try {
    var r2 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/xml; charset=utf-8" }, body: xml });
    var t2 = await r2.text();
    console.log("Attempt 2 (application/xml):", r2.status, t2);
    if (t2.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t2 };
  } catch (e) { console.log("Attempt 2 error:", e.message); }

  // Attempt 3: form-encoded
  try {
    var r3 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "xml=" + encodeURIComponent(xml) });
    var t3 = await r3.text();
    console.log("Attempt 3 (form):", r3.status, t3);
    if (t3.toLowerCase().indexOf("success") !== -1) return { ok: true, response: t3 };
    return { ok: false, response: t3 };
  } catch (e) { return { ok: false, response: e.message }; }
}

// ═══════════════════════════════════════════════════
// ORDER LOG for debugging
// ═══════════════════════════════════════════════════
var orderLog = [];

// ═══════════════════════════════════════════════════
// ROUTE: Submit order (from Retell agent)
// ═══════════════════════════════════════════════════
app.post("/retell/function/submit_order", async function (req, res) {
  var logEntry = { time: new Date().toISOString(), raw_body_keys: Object.keys(req.body), args: null, xml: null, pos_result: null, error: null };

  try {
    var orderData = req.body.args || req.body;
    logEntry.args = orderData;
    console.log("\n=== ORDER FROM RETELL ===");
    console.log(JSON.stringify(orderData, null, 2));

    var result = buildOrderXml(orderData);
    logEntry.xml = result.xml;
    logEntry.refNumber = result.refNumber;
    console.log("\n=== XML ===");
    console.log(result.xml);

    var posResult = await sendToPOS(result.xml);
    logEntry.pos_result = posResult;
    console.log("\n=== POS RESULT ===", posResult);

    if (posResult.ok) {
      logEntry.status = "SUCCESS";
      res.json("Order placed successfully! Reference number " + result.refNumber + ". " + posResult.response);
    } else {
      logEntry.status = "POS_ISSUE";
      res.json("Order received, reference number " + result.refNumber + ". Staff will confirm. " + posResult.response);
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
// DEBUG: View last orders
// ═══════════════════════════════════════════════════
app.get("/debug", function (req, res) {
  res.json({ total: orderLog.length, orders: orderLog });
});

// ═══════════════════════════════════════════════════
// TEST: Regular order
// ═══════════════════════════════════════════════════
app.get("/test-order", async function (req, res) {
  var testOrder = {
    order_type: "pickup",
    customer_name: "Test Regular",
    customer_phone: "8888888888",
    items: [{
      item_name: '14" Large Cheese Pizza',
      quantity: 1,
      unit_price: 11.99,
      modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }],
    }],
    subtotal: 13.99, tax: 0.84, total: 14.83,
  };
  var built = buildOrderXml(testOrder);
  var posResult = await sendToPOS(built.xml);
  res.json({ xml: built.xml, pos_response: posResult, ref: built.refNumber });
});

// ═══════════════════════════════════════════════════
// TEST: Combo order — Party Deal with free first topping
// ═══════════════════════════════════════════════════
app.get("/test-combo", async function (req, res) {
  var testCombo = {
    order_type: "pickup",
    customer_name: "Test Combo",
    customer_phone: "8888888888",
    special_instructions: "Please ring the doorbell",
    items: [{
      item_name: 'PARTY DEAL: 4 LARGE 1-TOP PIZZAS, 48 BUFFALO WINGS, FRIES & 2 LITER SODA',
      quantity: 1,
      unit_price: 84.99,
      is_combo: true,
      components: [
        {
          component_name: "14 inch Cheese Pizza",
          modifiers: [
            { group: "Add Toppings", name: "Pepperoni", price: 2.00 }
          ]
        },
        {
          component_name: "14 inch Cheese Pizza",
          modifiers: [
            { group: "Add Toppings", name: "Bacon", price: 2.00 }
          ]
        },
        {
          component_name: "14 inch Cheese Pizza",
          modifiers: [
            { group: "Add Toppings", name: "Green Pepper", price: 2.00 },
            { group: "Add Toppings", name: "Jalapeno", price: 2.00 }
          ]
        },
        {
          component_name: "14 inch Cheese Pizza",
          modifiers: [
            { group: "Add Toppings", name: "Black Olives", price: 2.00 }
          ]
        },
        {
          component_name: "48 Buffalo Wings",
          modifiers: [
            { group: "Wings - Flavors", name: "Half Honey BBQ Half Hot", price: 0 },
            { group: "Wings - Dressing", name: "Ranch", price: 0 }
          ]
        },
        {
          component_name: "Large French Fries",
          modifiers: []
        },
        {
          component_name: "2 Liter Soda",
          modifiers: [
            { group: "Soda", name: "Dr Pepper", price: 0 }
          ]
        }
      ]
    }],
    subtotal: 86.99, tax: 5.22, total: 92.21,
  };

  var built = buildOrderXml(testCombo);
  var posResult = await sendToPOS(built.xml);
  res.json({ xml: built.xml, pos_response: posResult, ref: built.refNumber });
});

// ═══════════════════════════════════════════════════
// ROUTE: Verify delivery address via Google Maps
// ═══════════════════════════════════════════════════
function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 3958.8;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLng = ((lng2 - lng1) * Math.PI) / 180;
  var a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.post("/retell/function/verify_address", async function (req, res) {
  try {
    var orderData = req.body.args || req.body;
    var address = orderData.address;
    console.log("\n=== VERIFY ADDRESS ===", address);

    if (!address || address.trim().length < 5) {
      return res.json("INVALID: No address provided. Please ask for full delivery address.");
    }
    if (!CONFIG.GOOGLE_MAPS_API_KEY) {
      return res.json("FOUND: Address accepted as-is. Address: " + address);
    }

    var geoResponse = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(address) + "&key=" + CONFIG.GOOGLE_MAPS_API_KEY);
    var geoData = await geoResponse.json();

    if (geoData.status !== "OK" || !geoData.results || geoData.results.length === 0) {
      return res.json("NOT_FOUND: Could not find this address. Ask customer to spell the street name.");
    }

    var result = geoData.results[0];
    var formatted = result.formatted_address;
    var loc = result.geometry.location;
    var distance = haversineDistance(CONFIG.RESTAURANT_LAT, CONFIG.RESTAURANT_LNG, loc.lat, loc.lng);
    var distR = Math.round(distance * 10) / 10;

    if (distance > CONFIG.MAX_DELIVERY_MILES) {
      return res.json("OUT_OF_RANGE: " + distR + " miles away, beyond " + CONFIG.MAX_DELIVERY_MILES + "-mile range. Address: " + formatted + ". Offer pickup instead.");
    }
    var hasStreetNum = result.address_components && result.address_components.some(function (c) { return c.types.indexOf("street_number") !== -1; });
    if (!hasStreetNum) {
      return res.json("PARTIAL: Found area but not exact address: " + formatted + ". Ask for house/building number.");
    }
    return res.json("FOUND: Verified. " + formatted + ". Distance: " + distR + " miles. OK.");
  } catch (error) {
    return res.json("FOUND: Address accepted (verification unavailable). Address: " + (req.body && req.body.args && req.body.args.address || "unknown"));
  }
});

// ═══════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════
app.get("/", function (req, res) {
  res.json({
    status: "running",
    restaurant_id: CONFIG.RESTAURANT_ID,
    endpoints: {
      submit_order: "POST /retell/function/submit_order",
      verify_address: "POST /retell/function/verify_address",
      test_order: "GET /test-order",
      test_combo: "GET /test-combo",
      debug: "GET /debug",
    },
  });
});

app.listen(CONFIG.PORT, function () {
  console.log("POS Bridge on port " + CONFIG.PORT + " | Restaurant: " + CONFIG.RESTAURANT_ID);
});
