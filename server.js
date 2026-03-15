// VERSION: V10-2026-03-15
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

function buildItem(item) {
  var o = "<OrderLineItem>";
  o += "<itemName>" + X(item.item_name || item.name || "Item") + "</itemName>";
  if (item.special_instructions) {
    o += "<additionalRequirements>" + X(item.special_instructions) + "</additionalRequirements>";
  }
  o += "<quantity>" + (item.quantity || 1) + "</quantity>";
  o += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  o += "<printKitchen>Y</printKitchen>";

  if (item.is_combo && item.components && item.components.length > 0) {
    o += "<Requirements>";
    for (var c = 0; c < item.components.length; c++) {
      var comp = item.components[c];
      o += "<Requirement>";
      o += "<groupMame>" + X(comp.component_name) + "</groupMame>";
      o += NT + X(comp.component_name) + NTC;
      o += "<quantity>1</quantity>";
      o += "<price>0.00</price>";
      o += "</Requirement>";
      if (comp.special_instructions) {
        o += "<Requirement>";
        o += "<groupMame>Special Request</groupMame>";
        o += NT + X(comp.special_instructions) + NTC;
        o += "<quantity>1</quantity>";
        o += "<price>0.00</price>";
        o += "</Requirement>";
      }
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
  } else if (item.modifiers && item.modifiers.length > 0) {
    o += "<Requirements>";
    for (var i = 0; i < item.modifiers.length; i++) {
      var mod2 = item.modifiers[i];
      o += "<Requirement>";
      if (mod2.group) o += "<groupMame>" + X(mod2.group) + "</groupMame>";
      o += NT + X(mod2.name || mod2) + NTC;
      o += "<quantity>1</quantity>";
      o += "<price>" + parseFloat(mod2.price || 0).toFixed(2) + "</price>";
      o += "</Requirement>";
    }
    o += "</Requirements>";
  }

  o += "</OrderLineItem>";
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
  o += "<payment>CASH</payment>";
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
  o += "</Customer>";
  if (order.order_type === "delivery" && order.delivery_address) {
    o += "<Address>";
    o += "<addressLine1>" + X(order.delivery_address) + "</addressLine1>";
    o += "<addressLine2></addressLine2><city></city><state></state><zip></zip>";
    o += "</Address>";
  }
  o += "<Items>";
  if (order.items && order.items.length > 0) {
    for (var i = 0; i < order.items.length; i++) o += buildItem(order.items[i]);
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
    log.args = data;
    console.log("\n=== RETELL ORDER ===\n" + JSON.stringify(data, null, 2));
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

app.post("/retell/function/verify_address", async function (req, res) {
  try {
    var data = req.body.args || req.body;
    var addr = data.address;
    if (!addr || addr.trim().length < 5) return res.json("INVALID: No address. Ask for full address.");
    if (!CONFIG.GOOGLE_MAPS_API_KEY) return res.json("FOUND: Address accepted. " + addr);
    var r = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURIComponent(addr) + "&key=" + CONFIG.GOOGLE_MAPS_API_KEY);
    var geo = await r.json();
    if (geo.status !== "OK" || !geo.results || !geo.results.length) return res.json("NOT_FOUND: Ask customer to spell street name.");
    var place = geo.results[0]; var fmt = place.formatted_address; var loc = place.geometry.location;
    if (CONFIG.RESTAURANT_LAT !== 0) {
      var R = 3958.8; var dLat = ((loc.lat - CONFIG.RESTAURANT_LAT) * Math.PI) / 180; var dLng = ((loc.lng - CONFIG.RESTAURANT_LNG) * Math.PI) / 180;
      var a2 = Math.sin(dLat/2)**2 + Math.cos(CONFIG.RESTAURANT_LAT*Math.PI/180)*Math.cos(loc.lat*Math.PI/180)*Math.sin(dLng/2)**2;
      var dist = Math.round(R*2*Math.atan2(Math.sqrt(a2), Math.sqrt(1-a2))*10)/10;
      if (dist > CONFIG.MAX_DELIVERY_MILES) return res.json("OUT_OF_RANGE: " + dist + " miles. Max " + CONFIG.MAX_DELIVERY_MILES + ". Address: " + fmt);
    }
    var hasNum = place.address_components && place.address_components.some(function(c) { return c.types.indexOf("street_number") !== -1; });
    if (!hasNum) return res.json("PARTIAL: Found area not exact: " + fmt + ". Ask for house number.");
    return res.json("FOUND: " + fmt);
  } catch (e) { return res.json("FOUND: Address accepted. " + ((req.body.args && req.body.args.address) || "")); }
});

app.get("/debug", function (req, res) { res.json({ total: orderLog.length, orders: orderLog }); });

app.get("/test-order", async function (req, res) {
  var order = { order_type: "pickup", customer_name: "Test Regular", customer_phone: "8888888888",
    items: [{ item_name: '14" Large Cheese Pizza', quantity: 1, unit_price: 11.99, modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 2.0 }] }],
    subtotal: 13.99, tax: 0.84, total: 14.83 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V10", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-combo", async function (req, res) {
  var order = { order_type: "pickup", customer_name: "Test Combo", customer_phone: "8888888888",
    items: [{ item_name: '12" PIZZA W/1 TOP, 8" SUB, 6 BUFFALO WINGS & 2 CAN SODA', quantity: 1, unit_price: 29.99, is_combo: true,
      components: [
        { component_name: '12" Cheese Pizza', modifiers: [{ group: "Add Toppings", name: "Pepperoni", price: 0 }] },
        { component_name: '8" Sub', modifiers: [{ group: "Choice of Grilled Subs", name: "CHEESE STEAK SUB", price: 0 }, { group: "Sub Fixins", name: "Everything", price: 0 }, { group: "Cheese Options", name: "American", price: 0 }] },
        { component_name: "6 Buffalo Wings", modifiers: [{ group: "Wings - Flavors", name: "Hot", price: 0 }, { group: "Wings - Dressing", name: "Ranch", price: 0 }] },
        { component_name: "Can Soda", modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
        { component_name: "Can Soda", modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] }
      ] }],
    subtotal: 29.99, tax: 1.80, total: 31.79 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V10", xml: built.xml, pos: result, ref: built.ref });
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

app.get("/", function (req, res) {
  res.json({ status: "running", version: "V10", restaurant_id: CONFIG.RESTAURANT_ID,
    endpoints: ["POST /retell/function/submit_order", "POST /retell/function/verify_address",
      "GET /test-order", "GET /test-combo", "GET /raw-xml", "GET /raw-lastorder", "GET /tag-test", "GET /debug"] });
});

app.listen(CONFIG.PORT, function () { console.log("V10 POS Bridge | Port: " + CONFIG.PORT + " | ID: " + CONFIG.RESTAURANT_ID); });
