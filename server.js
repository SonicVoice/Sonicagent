// VERSION: V16-2026-03-25
var express = require("express");
var app = express();
app.use(express.json({ limit: "50mb" }));

// Tag constants — built via concatenation to prevent any stripping
var NT = "<" + "na" + "me" + ">";
var NTC = "</" + "na" + "me" + ">";

// Clean item name: strip topping/modifier words that agent may accidentally include
// Toppings belong in Requirements, not in the item name
function cleanItemName(name, modifiers) {
  if (!name || !modifiers || modifiers.length === 0) return name;
  var clean = name;
  // Only clean pizza names — look for "pizza" or "Pizza" in the name
  if (clean.toLowerCase().indexOf("pizza") === -1) return clean;
  // Common pattern: "14 inch Pepperoni Pizza" should be "14 inch Cheese Pizza"
  // Remove topping words that appear in modifiers from the pizza name
  for (var i = 0; i < modifiers.length; i++) {
    var modName = (modifiers[i].name || "").trim();
    if (modName && modName.length > 2) {
      // Check if modifier name appears in item name (case insensitive)
      var regex = new RegExp("\\b" + modName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (regex.test(clean)) {
        clean = clean.replace(regex, "").replace(/\s{2,}/g, " ").trim();
      }
    }
  }
  // If we stripped toppings and "Cheese" isn't in the name, add it back
  if (clean.toLowerCase().indexOf("cheese") === -1 && clean.toLowerCase().indexOf("pizza") !== -1) {
    clean = clean.replace(/(\d+[""\s]*(?:inch|in|sm|med|lrg|x-lrg|xx-lrg)?)\s*(pizza)/i, "$1 Cheese $2");
    // Fallback: just add Cheese before Pizza
    if (clean.toLowerCase().indexOf("cheese") === -1) {
      clean = clean.replace(/(pizza)/i, "Cheese $1");
    }
  }
  // Clean up leftover connecting words
  clean = clean.replace(/\b(and|with|w\/|plus)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  return clean.replace(/\s{2,}/g, " ").trim();
}

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

// Strip junk words that LLM may add to names/modifiers
function stripJunk(s) {
  if (!s) return s;
  return String(s)
    .replace(/\b(house\s*special|combo\s*deal|special\s*deal|combo|deal|special)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Build a single regular item
function buildRegularItem(item) {
  var rawName = item.item_name || item.name || "Item";
  var mods = item.modifiers || [];
  // Safety: clean topping words out of pizza item names + strip junk
  var itemName = stripJunk(cleanItemName(rawName, mods));
  
  var o = "<OrderLineItem>";
  o += "<itemName>" + X(itemName) + "</itemName>";
  if (item.special_instructions) {
    o += "<additionalRequirements>" + X(stripJunk(item.special_instructions)) + "</additionalRequirements>";
  }
  if (item.item_id && /^\d+$/.test(String(item.item_id))) {
    o += "<foodMenuItemId>" + X(item.item_id) + "</foodMenuItemId>";
  }
  o += "<quantity>" + (item.quantity || 1) + "</quantity>";
  o += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  o += "<printKitchen>Y</printKitchen>";

  if (mods.length > 0) {
    o += "<Requirements>";
    for (var i = 0; i < mods.length; i++) {
      var mod = mods[i];
      o += "<Requirement>";
      if (mod.group) o += "<groupMame>" + X(stripJunk(mod.group)) + "</groupMame>";
      o += NT + X(stripJunk(mod.name || mod)) + NTC;
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

    // ═══════════════════════════════════════════════════
    // AUTO COMBO DETECTION — server-side, no LLM dependency
    // Scans items, matches combos, adds fixed XML discount
    // ═══════════════════════════════════════════════════
    var appliedDiscounts = [];

    // If agent already sent combo_deals, use those (backward compatible)
    if (order.combo_deals && order.combo_deals.length > 0) {
      for (var cd = 0; cd < order.combo_deals.length; cd++) {
        var deal = order.combo_deals[cd];
        var comboName = deal.name || deal.combo_name || "Combo Deal";
        var comboId = deal.id || deal.combo_id || "";
        var discountAmt = 0;
        if (deal.discount) discountAmt = Math.abs(parseFloat(deal.discount));
        else if (deal.price) {
          var comboGroup = deal.group;
          var rt = 0;
          for (var j = 0; j < order.items.length; j++) {
            if (order.items[j].combo_group == comboGroup) {
              rt += parseFloat(order.items[j].unit_price || 0) * (order.items[j].quantity || 1);
            }
          }
          discountAmt = Math.round((rt - parseFloat(deal.price)) * 100) / 100;
        }
        if (discountAmt > 0) appliedDiscounts.push({ name: comboName, id: comboId, amt: discountAmt });
      }
    }

    // If agent did NOT send combo_deals, auto-detect from items
    if (appliedDiscounts.length === 0) {
      var items = order.items || [];
      var isPickup = (order.order_type || "").toLowerCase() !== "delivery";

      // Categorize items (track which are "used" by a combo)
      var cheesePizzas = { "10": [], "12": [], "14": [], "16": [], "18": [] };
      var subs8 = [], subs12 = [], bufWings = [], wholeWings = [], fries = [], canSodas = [], twoLiters = [];
      var hasCheeseBurger = false, hasCheeseFish = false;
      var lakeTrout3 = false;

      // Specialty pizza IDs — never in combos
      var specialtyIds = ["655","656","657","658","659","660","661","662","663","664","665","666","667","829"];

      for (var si = 0; si < items.length; si++) {
        var it = items[si];
        var id = String(it.item_id || "");
        var nm = (it.item_name || "").toLowerCase();
        var qty = it.quantity || 1;

        for (var qq = 0; qq < qty; qq++) {
          // Cheese pizzas by size
          if (id === "735") cheesePizzas["10"].push(si);
          else if (id === "736") cheesePizzas["12"].push(si);
          else if (id === "737") cheesePizzas["14"].push(si);
          else if (id === "738") cheesePizzas["16"].push(si);
          else if (id === "739") cheesePizzas["18"].push(si);
          // Subs
          else if (nm.indexOf("sub") !== -1 || nm.indexOf("cheesesteak") !== -1 || nm.indexOf("cheese steak") !== -1) {
            // Detect 8" vs 12" sub by name keywords or price
            var is12 = (nm.indexOf("12") !== -1 || nm.indexOf("whole") !== -1 || parseFloat(it.unit_price||0) >= 10);
            if (is12) subs12.push(si);
            else subs8.push(si);
          }
          // Wings
          else if ((nm.indexOf("buffalo") !== -1 || nm.indexOf("bf wing") !== -1) && nm.indexOf("whole") === -1) {
            var wqty = 0;
            var wm = nm.match(/(\d+)\s*pc/); if (wm) wqty = parseInt(wm[1]);
            bufWings.push({ idx: si, qty: wqty });
          }
          else if (nm.indexOf("whole") !== -1) {
            var wqty2 = 0;
            var wm2 = nm.match(/(\d+)\s*pc/); if (wm2) wqty2 = parseInt(wm2[1]);
            wholeWings.push({ idx: si, qty: wqty2 });
          }
          // Fries
          else if (nm.indexOf("frie") !== -1 || nm.indexOf("fries") !== -1 || id === "607") fries.push(si);
          // Sodas
          else if (id === "728" || (nm.indexOf("soda") !== -1 && nm.indexOf("2") === -1 && nm.indexOf("liter") === -1 && nm.indexOf("litter") === -1)) canSodas.push(si);
          else if (id === "790" || nm.indexOf("2 liter") !== -1 || nm.indexOf("2 litter") !== -1 || nm.indexOf("2-liter") !== -1 || nm.indexOf("starry") !== -1) twoLiters.push(si);
          // Burger / Fish
          else if (id === "713" || nm.indexOf("cheese burger") !== -1 || nm.indexOf("cheeseburger") !== -1) hasCheeseBurger = true;
          else if ((id === "718" || nm.indexOf("cheese fish") !== -1) && nm.indexOf("sub") === -1) hasCheeseFish = true;
          // Lake trout
          else if (id === "651" || (nm.indexOf("lake trout") !== -1 && nm.indexOf("3") !== -1)) lakeTrout3 = true;
        }
      }

      // Also categorize subs more broadly (any sub-like item under certain price)
      for (var si2 = 0; si2 < items.length; si2++) {
        var it2 = items[si2];
        var id2 = String(it2.item_id || "");
        var nm2 = (it2.item_name || "").toLowerCase();
        var price2 = parseFloat(it2.unit_price || 0);
        // Grilled/Cold/Special sub IDs
        var subIds8 = ["684","685","686","687","688","689","690","691","692","693","694","695","801","833",
                       "702","703","704","705","706","707","708","709","710","825","826",
                       "723","724","725","726","727"];
        if (subIds8.indexOf(id2) !== -1 && subs8.indexOf(si2) === -1 && subs12.indexOf(si2) === -1) {
          if (price2 < 10) subs8.push(si2);
          else subs12.push(si2);
        }
      }

      // Helper to add a discount
      function addDisc(name, id, amt) {
        appliedDiscounts.push({ name: name, id: id, amt: Math.abs(amt) });
        console.log("AUTO-COMBO: " + name + " | ID:" + id + " | -$" + Math.abs(amt).toFixed(2));
      }

      // Track which items are "used" by combos
      var used = {};

      // ── PIZZA DEALS (cheese only) ──
      var sizes = ["14","16","12"];
      for (var ps = 0; ps < sizes.length; ps++) {
        var sz = sizes[ps];
        var pizzas = cheesePizzas[sz].filter(function(x){ return !used[x]; });

        // 3-Pizza Special (3 same-size + 2L soda)
        if (pizzas.length >= 3 && twoLiters.filter(function(x){return !used[x];}).length >= 1) {
          if (sz === "14") { addDisc("DISCOUNT 3x 14 pizza w/ 1 TOPP, 2Lt Soda", "862", 8.47); }
          else if (sz === "16") { addDisc("DISCOUNT 3x 16 pizza w/ 1 TOPP, 2Lt Soda", "863", 13.97); }
          else continue;
          used[pizzas[0]]=1; used[pizzas[1]]=1; used[pizzas[2]]=1;
          var freeSoda = twoLiters.filter(function(x){return !used[x];})[0]; used[freeSoda]=1;
          pizzas = cheesePizzas[sz].filter(function(x){ return !used[x]; });
        }

        // Double Deal (2 same-size)
        while (pizzas.length >= 2) {
          if (sz === "12") addDisc("DISCOUNT 2x 12 Pizza w/ 1 TOPPINNG", "869", 4.99);
          else if (sz === "14") addDisc("DISCOUNT 2x 14 Pizza w/ 1 TOPPINNG", "870", 5.99);
          else if (sz === "16") addDisc("DISCOUNT 2x 16 Pizza w/ 1 TOPPINNG", "871", 7.99);
          else break;
          used[pizzas[0]]=1; used[pizzas[1]]=1;
          pizzas = cheesePizzas[sz].filter(function(x){ return !used[x]; });
        }
      }

      // ── PIZZA + WINGS (pizza + 10 buffalo + 2L) ──
      for (var pw = 0; pw < sizes.length; pw++) {
        var szp = sizes[pw];
        var pzLeft = cheesePizzas[szp].filter(function(x){return !used[x];});
        var wLeft = bufWings.filter(function(x){return !used[x.idx] && x.qty >= 9;});
        var sLeft = twoLiters.filter(function(x){return !used[x];});
        if (pzLeft.length >= 1 && wLeft.length >= 1 && sLeft.length >= 1) {
          if (szp === "12") addDisc("DISCOUNT 12 Pizza w/ 1 TOPP 10 Buff W 2Lt Soda", "865", 3.65);
          else if (szp === "14") addDisc("DISCOUNT 14 Pizza w/ 1 TOPP 10 Buff W 2Lt Soda", "866", 4.15);
          else if (szp === "16") addDisc("DISCOUNT 16 Pizza w/ 1 TOPP 10 Buff W 2Lt Soda", "867", 5.65);
          else continue;
          used[pzLeft[0]]=1; used[wLeft[0].idx]=1; used[sLeft[0]]=1;
        }
      }

      // ── PIZZA + SUB + WINGS COMBO (pizza + sub + wings + 2 cans) ──
      for (var pc = 0; pc < sizes.length; pc++) {
        var szc = sizes[pc];
        var pzC = cheesePizzas[szc].filter(function(x){return !used[x];});
        var subC = subs8.filter(function(x){return !used[x];});
        var canC = canSodas.filter(function(x){return !used[x];});
        if (szc === "12" && pzC.length>=1 && subC.length>=1 && bufWings.filter(function(x){return !used[x.idx]&&x.qty>=6;}).length>=1 && canC.length>=2) {
          addDisc("DISCOUNT 12 PIZZA W/1 TOP 8 SUB, 6 BUFFALO WING and 2 CAN OF SODA", "855", 1.98);
          used[pzC[0]]=1; used[subC[0]]=1; var bw=bufWings.filter(function(x){return !used[x.idx]&&x.qty>=6;})[0]; used[bw.idx]=1; used[canC[0]]=1; used[canC[1]]=1;
        } else if (szc === "14" && pzC.length>=1 && subC.length>=1 && bufWings.filter(function(x){return !used[x.idx]&&x.qty>=8;}).length>=1 && canC.length>=2) {
          addDisc("DISCOUNT 14 PIZZA W/1 TOP 8 SUB, 8 BUFFALO WING and 2 CAN OF SODA", "882", 2.98);
          used[pzC[0]]=1; used[subC[0]]=1; var bw2=bufWings.filter(function(x){return !used[x.idx]&&x.qty>=8;})[0]; used[bw2.idx]=1; used[canC[0]]=1; used[canC[1]]=1;
        }
      }

      // ── PIZZA + SUB (pizza + sub + fries + can) ──
      for (var psc = 0; psc < sizes.length; psc++) {
        var szs = sizes[psc];
        var pzS = cheesePizzas[szs].filter(function(x){return !used[x];});
        var subS = subs8.filter(function(x){return !used[x];});
        var frS = fries.filter(function(x){return !used[x];});
        var canS = canSodas.filter(function(x){return !used[x];});
        if (pzS.length>=1 && subS.length>=1 && frS.length>=1 && canS.length>=1) {
          if (szs === "12") addDisc("DISCOUNT 12 Pizza w/ 1 TOPP 8 Sub FF can Soda", "868", 1.98);
          else if (szs === "14") addDisc("DISCOUNT 14 PIZZA w/ 1 TOPP 8 Sub FF can soda", "873", 2.15);
          else if (szs === "16") addDisc("DISCOUNT 16 PIZZA w/1 TOPP 8 Sub FF Can soda", "853", 1.98);
          else continue;
          used[pzS[0]]=1; used[subS[0]]=1; used[frS[0]]=1; used[canS[0]]=1;
        }
      }

      // ── WINGS + SUB (sub + 6 buffalo + can) ──
      var subW = subs8.filter(function(x){return !used[x];});
      var bwW = bufWings.filter(function(x){return !used[x.idx]&&x.qty>=6;});
      var canW = canSodas.filter(function(x){return !used[x];});
      if (subW.length>=1 && bwW.length>=1 && canW.length>=1) {
        addDisc("DISCOUNT 8 Sub and 6 Buffalo WING CAN Soda", "857", 0.49);
        used[subW[0]]=1; used[bwW[0].idx]=1; used[canW[0]]=1;
      }

      // ── SUB DEALS ──
      var subLeft = subs8.filter(function(x){return !used[x];});
      var frLeft = fries.filter(function(x){return !used[x];});
      var canLeft = canSodas.filter(function(x){return !used[x];});
      // 3x sub deal
      if (subLeft.length>=3 && frLeft.length>=3 && canLeft.length>=3) {
        addDisc("DISCOUNT 3-8 SUB,3 FRENCH FRIES and 3 CANS OF SODA", "864", 5.45);
        used[subLeft[0]]=1;used[subLeft[1]]=1;used[subLeft[2]]=1;
        used[frLeft[0]]=1;used[frLeft[1]]=1;used[frLeft[2]]=1;
        used[canLeft[0]]=1;used[canLeft[1]]=1;used[canLeft[2]]=1;
      } else if (subLeft.length>=2 && frLeft.length>=2 && canLeft.length>=2) {
        addDisc("DISCOUNT 2x 8 Sub Combo", "859", 2.97);
        used[subLeft[0]]=1;used[subLeft[1]]=1;used[frLeft[0]]=1;used[frLeft[1]]=1;used[canLeft[0]]=1;used[canLeft[1]]=1;
      }
      // 1x sub deal (remaining)
      subLeft = subs8.filter(function(x){return !used[x];});
      frLeft = fries.filter(function(x){return !used[x];});
      canLeft = canSodas.filter(function(x){return !used[x];});
      while (subLeft.length>=1 && frLeft.length>=1 && canLeft.length>=1) {
        addDisc("DISCOUNT 8 Sub Combo", "858", 0.49);
        used[subLeft[0]]=1; used[frLeft[0]]=1; used[canLeft[0]]=1;
        subLeft = subs8.filter(function(x){return !used[x];});
        frLeft = fries.filter(function(x){return !used[x];});
        canLeft = canSodas.filter(function(x){return !used[x];});
      }

      // 12" sub deal
      var sub12Left = subs12.filter(function(x){return !used[x];});
      frLeft = fries.filter(function(x){return !used[x];});
      canLeft = canSodas.filter(function(x){return !used[x];});
      while (sub12Left.length>=1 && frLeft.length>=1 && canLeft.length>=1) {
        addDisc("DISCOUNT 12 Sub Combo", "860", 0.99);
        used[sub12Left[0]]=1; used[frLeft[0]]=1; used[canLeft[0]]=1;
        sub12Left = subs12.filter(function(x){return !used[x];});
        frLeft = fries.filter(function(x){return !used[x];});
        canLeft = canSodas.filter(function(x){return !used[x];});
      }

      // ── WINGS SPECIALS (6 buf + fries + can) ──
      var bwLeft = bufWings.filter(function(x){return !used[x.idx]&&x.qty===6;});
      frLeft = fries.filter(function(x){return !used[x];});
      canLeft = canSodas.filter(function(x){return !used[x];});
      while (bwLeft.length>=1 && frLeft.length>=1 && canLeft.length>=1) {
        addDisc("DISCOUNT 6 Pcs Buffalo wings Combo", "877", 3.49);
        used[bwLeft[0].idx]=1; used[frLeft[0]]=1; used[canLeft[0]]=1;
        bwLeft = bufWings.filter(function(x){return !used[x.idx]&&x.qty===6;});
        frLeft = fries.filter(function(x){return !used[x];});
        canLeft = canSodas.filter(function(x){return !used[x];});
      }

      // 4 whole wings + fries + can
      var wwLeft = wholeWings.filter(function(x){return !used[x.idx]&&x.qty===4;});
      frLeft = fries.filter(function(x){return !used[x];});
      canLeft = canSodas.filter(function(x){return !used[x];});
      while (wwLeft.length>=1 && frLeft.length>=1 && canLeft.length>=1) {
        addDisc("DISCOUNT 4 Pcs Whole wings Combo", "876", 3.49);
        used[wwLeft[0].idx]=1; used[frLeft[0]]=1; used[canLeft[0]]=1;
        wwLeft = wholeWings.filter(function(x){return !used[x.idx]&&x.qty===4;});
        frLeft = fries.filter(function(x){return !used[x];});
        canLeft = canSodas.filter(function(x){return !used[x];});
      }

      // ── CHICKEN BOX (2x4 whole + 2 cans) ──
      wwLeft = wholeWings.filter(function(x){return !used[x.idx]&&x.qty===4;});
      canLeft = canSodas.filter(function(x){return !used[x];});
      if (wwLeft.length>=2 && canLeft.length>=2) {
        addDisc("DISCOUNT 2-FOUR WING CHICKEN BOX and 2 CAN SODA", "875", 0.99);
        used[wwLeft[0].idx]=1;used[wwLeft[1].idx]=1;used[canLeft[0]]=1;used[canLeft[1]]=1;
      }
      // 2x6 buffalo + 2 cans
      bwLeft = bufWings.filter(function(x){return !used[x.idx]&&x.qty===6;});
      canLeft = canSodas.filter(function(x){return !used[x];});
      if (bwLeft.length>=2 && canLeft.length>=2) {
        addDisc("DISCOUNT 2-SIX BUFFALO WINGS CHICKEN BOX and 2 CAN SODA", "883", 0.99);
        used[bwLeft[0].idx]=1;used[bwLeft[1].idx]=1;used[canLeft[0]]=1;used[canLeft[1]]=1;
      }

      // ── BURGER COMBO ──
      if (hasCheeseBurger) {
        frLeft = fries.filter(function(x){return !used[x];});
        canLeft = canSodas.filter(function(x){return !used[x];});
        if (frLeft.length>=1 && canLeft.length>=1) {
          addDisc("DISCOUNT CHEESE BURGER FF w/ Soda", "872", 0.99);
          used[frLeft[0]]=1; used[canLeft[0]]=1;
        }
      }

      // ── FISH COMBO ──
      if (hasCheeseFish) {
        frLeft = fries.filter(function(x){return !used[x];});
        canLeft = canSodas.filter(function(x){return !used[x];});
        if (frLeft.length>=1 && canLeft.length>=1) {
          addDisc("DISCOUNT Cheese Fish FF w/ Soda", "874", 0.99);
          used[frLeft[0]]=1; used[canLeft[0]]=1;
        }
      }

      // ── PICKUP SPECIALS ──
      if (isPickup) {
        for (var pusz in cheesePizzas) {
          var puPizzas = cheesePizzas[pusz].filter(function(x){return !used[x];});
          for (var pui = 0; pui < puPizzas.length; pui++) {
            if (pusz === "10") addDisc("DISCOUNT 10 PIZZA W/ ONE TOPPING", "878", 1.50);
            else if (pusz === "12") addDisc("DISCOUNT 12 CHEESE PIZZA", "879", 2.00);
            else if (pusz === "14") addDisc("DISCOUNT 14 CHEESE PIZZA", "880", 2.00);
            else if (pusz === "16") addDisc("DISCOUNT 16 CHEESE PIZZA", "881", 3.00);
          }
        }
      }
    }

    // Write all discount lines to XML
    for (var di = 0; di < appliedDiscounts.length; di++) {
      var disc = appliedDiscounts[di];
      o += "<OrderLineItem>";
      o += "<itemName>" + X(disc.name) + "</itemName>";
      if (disc.id && /^\d+$/.test(String(disc.id))) {
        o += "<foodMenuItemId>" + X(disc.id) + "</foodMenuItemId>";
      }
      o += "<quantity>1</quantity>";
      o += "<unitPrice>-" + disc.amt.toFixed(2) + "</unitPrice>";
      o += "<printKitchen>N</printKitchen>";
      o += "</OrderLineItem>";
      console.log("DISCOUNT APPLIED: " + disc.name + " [ID:" + disc.id + "] -$" + disc.amt.toFixed(2));
    }
  }
  o += "</Items></FoodOrder>";
  return { xml: o, ref: ref, discounts: appliedDiscounts };
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

// ═══════════════════════════════════════════════════
// ROUTE: Check order — returns deals + total WITHOUT submitting to POS
// Agent calls this at Confirm Order before card payment
// ═══════════════════════════════════════════════════
app.post("/retell/function/check_order", function (req, res) {
  try {
    var data = req.body.args || req.body;
    console.log("\n=== CHECK ORDER (no POS submit) ===");
    console.log(JSON.stringify(data, null, 2));

    // Run buildXml to get auto-detected discounts (we won't use the XML)
    var built = buildXml(data);

    // Calculate totals
    var itemsTotal = 0;
    var items = data.items || [];
    for (var i = 0; i < items.length; i++) {
      itemsTotal += parseFloat(items[i].unit_price || 0) * (items[i].quantity || 1);
    }
    itemsTotal = Math.round(itemsTotal * 100) / 100;

    var totalDiscount = 0;
    var dealNames = [];
    if (built.discounts && built.discounts.length > 0) {
      for (var d = 0; d < built.discounts.length; d++) {
        totalDiscount += built.discounts[d].amt;
        dealNames.push(built.discounts[d].name.replace(/^DISCOUNT\s*/i, ""));
      }
    }
    totalDiscount = Math.round(totalDiscount * 100) / 100;

    var afterDiscount = Math.round((itemsTotal - totalDiscount) * 100) / 100;
    var tax = Math.round(afterDiscount * CONFIG.TAX_RATE * 100) / 100;
    var deliveryFee = ((data.order_type || "").toLowerCase() === "delivery") ? CONFIG.DELIVERY_FEE : 0;
    var finalTotal = Math.round((afterDiscount + tax + deliveryFee) * 100) / 100;

    var responseMsg = "";
    if (dealNames.length > 0) {
      responseMsg = "DEALS APPLIED: " + dealNames.join(" + ") + ".";
      responseMsg += " Discount: $" + totalDiscount.toFixed(2) + " off.";
      responseMsg += " Subtotal: $" + afterDiscount.toFixed(2) + ".";
      responseMsg += " Tax: $" + tax.toFixed(2) + ".";
      if (deliveryFee > 0) responseMsg += " Delivery fee: $" + deliveryFee.toFixed(2) + ".";
      responseMsg += " Total: $" + finalTotal.toFixed(2) + ".";
      responseMsg += " Tell the customer about the deal and savings.";
    } else {
      responseMsg = "NO DEALS.";
      responseMsg += " Subtotal: $" + itemsTotal.toFixed(2) + ".";
      responseMsg += " Tax: $" + tax.toFixed(2) + ".";
      if (deliveryFee > 0) responseMsg += " Delivery fee: $" + deliveryFee.toFixed(2) + ".";
      responseMsg += " Total: $" + finalTotal.toFixed(2) + ".";
    }

    console.log("CHECK ORDER RESULT: " + responseMsg);
    res.json(responseMsg);
  } catch (e) {
    console.error("CHECK ORDER ERROR:", e);
    res.json("Could not check order. Read back items at regular prices.");
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
    log.discounts = built.discounts;
    console.log("\n=== XML ===\n" + built.xml);
    var result = await sendToPOS(built.xml);
    log.pos = result;
    log.status = result.ok ? "OK" : "FAIL";

    // Build response with discount info for agent to read back
    var responseMsg = "";
    if (result.ok) {
      responseMsg = "Order placed! Ref " + built.ref + ".";
      if (built.discounts && built.discounts.length > 0) {
        // Calculate totals
        var itemsTotal = 0;
        for (var ti = 0; ti < (data.items || []).length; ti++) {
          itemsTotal += parseFloat(data.items[ti].unit_price || 0) * (data.items[ti].quantity || 1);
        }
        var totalDiscount = 0;
        var dealNames = [];
        for (var di = 0; di < built.discounts.length; di++) {
          totalDiscount += built.discounts[di].amt;
          dealNames.push(built.discounts[di].name.replace(/^DISCOUNT\s*/i, ""));
        }
        var afterDiscount = Math.round((itemsTotal - totalDiscount) * 100) / 100;
        var tax = Math.round(afterDiscount * CONFIG.TAX_RATE * 100) / 100;
        var deliveryFee = (data.order_type === "delivery") ? CONFIG.DELIVERY_FEE : 0;
        var finalTotal = Math.round((afterDiscount + tax + deliveryFee) * 100) / 100;

        responseMsg += " DEAL APPLIED: " + dealNames.join(" + ") + ".";
        responseMsg += " Discount: $" + totalDiscount.toFixed(2) + " off.";
        responseMsg += " Subtotal after discount: $" + afterDiscount.toFixed(2) + ".";
        responseMsg += " Tax: $" + tax.toFixed(2) + ".";
        if (deliveryFee > 0) responseMsg += " Delivery fee: $" + deliveryFee.toFixed(2) + ".";
        responseMsg += " Total: $" + finalTotal.toFixed(2) + ".";
        responseMsg += " Tell the customer about the deal savings.";
      } else {
        // No discounts — include basic total
        var subAmt = parseFloat(data.subtotal || 0);
        var taxAmt = parseFloat(data.tax || (subAmt * CONFIG.TAX_RATE));
        var delAmt = (data.order_type === "delivery") ? CONFIG.DELIVERY_FEE : 0;
        var totAmt = parseFloat(data.total || (subAmt + taxAmt + delAmt));
        responseMsg += " Subtotal: $" + subAmt.toFixed(2) + ". Tax: $" + taxAmt.toFixed(2) + ".";
        if (delAmt > 0) responseMsg += " Delivery: $" + delAmt.toFixed(2) + ".";
        responseMsg += " Total: $" + totAmt.toFixed(2) + ".";
      }
      responseMsg += " " + result.response;
    } else {
      responseMsg = "Order ref " + built.ref + ". POS: " + result.response;
    }
    res.json(responseMsg);
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
    items: [{ item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
      modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] }],
    subtotal: 13.99, tax: 0.84, total: 14.83 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V16", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-combo", async function (req, res) {
  // Double Deal: 2x14" = $21.99 base. Pizza1: olives+onions(1 extra). Pizza2: tomatoes.
  // unit_price = base + toppings combined. Modifiers descriptive only (price:0).
  // Discount: FIXED -$5.99 from XML ID:870
  var order = { order_type: "pickup", customer_name: "Test DD14", customer_phone: "8888888888",
    items: [
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 15.99, combo_group: 1,
        modifiers: [
          { group: "Add Toppings", name: "Black Olives +$2.00", price: 0 },
          { group: "Add Toppings", name: "Onions +$2.00", price: 0 }
        ] },
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99, combo_group: 1,
        modifiers: [
          { group: "Add Toppings", name: "Tomatoes +$2.00", price: 0 }
        ] },
    ],
    combo_deals: [
      { group: 1, name: "DISCOUNT 2x 14 Pizza w/ 1 TOPPINNG", id: "870", discount: -5.99 }
    ],
    subtotal: 23.99, tax: 1.44, total: 25.43 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V16", note: "DD14: 15.99+13.99-5.99=23.99", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-combo2", async function (req, res) {
  // Pizza Sub Combo 14": pizza+sub+fries+can = $24.99 base
  // Discount: FIXED -$2.15 from XML ID:873
  var order = { order_type: "pickup", customer_name: "Test PSC", customer_phone: "8888888888",
    items: [
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99, combo_group: 1,
        modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] },
      { item_name: 'CHEESE STEAK SUB', item_id: "684", quantity: 1, unit_price: 8.49, combo_group: 1,
        modifiers: [
          { group: "Sub Fixins", name: "Everything", price: 0 },
          { group: "Cheese Options", name: "American", price: 0 }
        ] },
      { item_name: 'FRENCH FRIE', item_id: "607", quantity: 1, unit_price: 2.99, combo_group: 1 },
      { item_name: 'Soda', item_id: "728", quantity: 1, unit_price: 1.00, combo_group: 1,
        modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
    ],
    combo_deals: [
      { group: 1, name: "DISCOUNT 14 PIZZA w/ 1 TOPP 8 Sub FF can soda", id: "873", discount: -2.15 }
    ],
    subtotal: 24.32, tax: 1.46, total: 25.78 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V16", note: "PSC14: 13.99+8.49+2.99+1.00-2.15=24.32", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-3pizza", async function (req, res) {
  // 3-Pizza Special: MATCHES SCREENSHOT EXACTLY
  // Veggie($19.99) + Cheese+Pepperoni($13.99) + Cheese+Mushrooms($13.99)
  // Discount: FIXED -$8.47 from XML ID:862
  var order = { order_type: "pickup", customer_name: "Test 3Pizza", customer_phone: "8888888888",
    items: [
      { item_name: '14 inch VEGGIE Pizza', item_id: "659", quantity: 1, unit_price: 19.99, combo_group: 1,
        modifiers: [
          { group: "Add Toppings", name: "Adjustment: $2.00", price: 0 },
          { group: "Add Toppings", name: "Add Grilled Chicken", price: 0 }
        ] },
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99, combo_group: 1,
        modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] },
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99, combo_group: 1,
        modifiers: [{ group: "Add Toppings", name: "Mushrooms +$2.00", price: 0 }] },
    ],
    combo_deals: [
      { group: 1, name: "DISCOUNT 3x 14 pizza w/ 1 TOPP, 2Lt Soda", id: "862", discount: -8.47 }
    ],
    subtotal: 39.50, tax: 2.37, total: 41.87 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V16", note: "3P14: 19.99+13.99+13.99-8.47=39.50 (matches screenshot)", xml: built.xml, pos: result, ref: built.ref });
});

app.get("/test-delivery", async function (req, res) {
  var order = { order_type: "delivery", customer_name: "Test Delivery", customer_phone: "4105551234",
    delivery_address: "2755 Edmondson Ave, Baltimore, MD 21223",
    items: [{ item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
      modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] }],
    subtotal: 13.99, tax: 0.84, total: 16.78 };
  var built = buildXml(order);
  var result = await sendToPOS(built.xml);
  res.json({ version: "V16", xml: built.xml, pos: result, ref: built.ref });
});

// ═══ AUTO-DETECT TESTS — NO combo_deals sent, server must find them ═══
app.get("/test-auto-dd14", async function (req, res) {
  // Agent sends 2x 14" cheese pizzas, NO combo_deals. Server should auto-detect Double Deal.
  var order = { order_type: "pickup", customer_name: "Auto DD14", customer_phone: "8888888888",
    items: [
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 15.99,
        modifiers: [{ group: "Add Toppings", name: "Black Olives +$2.00", price: 0 },
                    { group: "Add Toppings", name: "Onions +$2.00", price: 0 }] },
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
        modifiers: [{ group: "Add Toppings", name: "Tomatoes +$2.00", price: 0 }] },
    ],
    subtotal: 23.99, tax: 1.44, total: 25.43 };
  var built = buildXml(order);
  res.json({ version: "V16-AUTO", note: "NO combo_deals sent. Server should add DISCOUNT 2x14 ID:870 -$5.99", xml: built.xml, ref: built.ref });
});

app.get("/test-auto-3pizza", async function (req, res) {
  // Agent sends 3x 14" + specialty Veggie, NO combo_deals. Server should auto-detect DD14 for the 2 cheese only.
  var order = { order_type: "pickup", customer_name: "Auto 3P", customer_phone: "8888888888",
    items: [
      { item_name: '14 inch VEGGIE Pizza', item_id: "659", quantity: 1, unit_price: 19.99,
        modifiers: [{ group: "Add Toppings", name: "Adjustment: $2.00", price: 0 },
                    { group: "Add Toppings", name: "Add Grilled Chicken", price: 0 }] },
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
        modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] },
      { item_name: '14 inch Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
        modifiers: [{ group: "Add Toppings", name: "Mushrooms +$2.00", price: 0 }] },
    ],
    subtotal: 41.98, tax: 2.52, total: 44.50 };
  var built = buildXml(order);
  res.json({ version: "V16-AUTO", note: "Veggie(specialty) excluded. Server should add DD14 ID:870 -$5.99 for 2 cheese only", xml: built.xml, ref: built.ref });
});

app.get("/test-auto-subcombo", async function (req, res) {
  // Agent sends sub + fries + soda, NO combo_deals. Server should add sub deal.
  var order = { order_type: "pickup", customer_name: "Auto Sub", customer_phone: "8888888888",
    items: [
      { item_name: 'CHEESE STEAK SUB', item_id: "684", quantity: 1, unit_price: 8.49,
        modifiers: [{ group: "Sub Fixins", name: "Everything", price: 0 },
                    { group: "Cheese Options", name: "American", price: 0 }] },
      { item_name: 'FRENCH FRIE', item_id: "607", quantity: 1, unit_price: 2.99 },
      { item_name: 'Soda', item_id: "728", quantity: 1, unit_price: 1.00,
        modifiers: [{ group: "Soda Can", name: "Coke", price: 0 }] },
    ],
    subtotal: 12.48, tax: 0.75, total: 13.23 };
  var built = buildXml(order);
  res.json({ version: "V16-AUTO", note: "Server should add DISCOUNT 8 Sub Combo ID:858 -$0.49", xml: built.xml, ref: built.ref });
});

app.get("/test-check-order", function (req, res) {
  // Simulate agent calling check_order with 2 large pizzas (Double Deal should apply)
  var order = { order_type: "pickup",
    items: [
      { item_name: '14 inch Lrg Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
        modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] },
      { item_name: '14 inch Lrg Cheese Pizza', item_id: "737", quantity: 1, unit_price: 13.99,
        modifiers: [{ group: "Add Toppings", name: "Mushrooms +$2.00", price: 0 }] },
    ] };
  var built = buildXml(order);
  var itemsTotal = 13.99 + 13.99;
  var discount = 0;
  var dealNames = [];
  for (var d = 0; d < built.discounts.length; d++) {
    discount += built.discounts[d].amt;
    dealNames.push(built.discounts[d].name);
  }
  var after = Math.round((itemsTotal - discount) * 100) / 100;
  var tax = Math.round(after * 0.06 * 100) / 100;
  var total = Math.round((after + tax) * 100) / 100;
  res.json({
    note: "Simulates check_order. DD14 should apply -$5.99",
    deals: dealNames, discount: discount, subtotal: after, tax: tax, total: total,
    agent_would_hear: dealNames.length > 0
      ? "DEALS APPLIED: " + dealNames.join(" + ") + ". Discount: $" + discount.toFixed(2) + " off. Subtotal: $" + after.toFixed(2) + ". Tax: $" + tax.toFixed(2) + ". Total: $" + total.toFixed(2) + "."
      : "NO DEALS. Subtotal: $" + itemsTotal.toFixed(2) + ". Tax: $" + tax.toFixed(2) + ". Total: $" + total.toFixed(2) + "."
  });
});

app.get("/raw-xml", function (req, res) {
  var order = { order_type: "pickup", customer_name: "Raw Test", customer_phone: "8888888888",
    items: [{ item_name: '14 inch Cheese Pizza', quantity: 1, unit_price: 13.99,
      modifiers: [{ group: "Add Toppings", name: "Pepperoni +$2.00", price: 0 }] }],
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
  res.json({ status: "running", version: "V16", restaurant_id: CONFIG.RESTAURANT_ID,
    has_payment: !!process.env.USAEPAY_KEY,
    endpoints: ["POST /retell/function/submit_order", "POST /retell/function/verify_address", "POST /retell/function/process_payment", "POST /retell/function/get_caller_id",
      "GET /orders (clean receipt list)", "GET /order/:ref (single receipt)", "GET /payment-log",
      "GET /test-order", "GET /test-combo (Double Deal)", "GET /test-combo2 (Pizza Sub)", "GET /test-3pizza (3 Pizza Special)",
      "POST /retell/function/check_order (get total with discounts before payment)",
      "GET /test-check-order (simulates check_order DD14)",
      "GET /test-auto-dd14 (auto-detect DD)", "GET /test-auto-3pizza (auto-detect specialty+cheese)", "GET /test-auto-subcombo (auto-detect sub)",
      "GET /test-delivery", "GET /test-payment", "GET /debug"] });
});

app.listen(CONFIG.PORT, function () { console.log("V16 POS Bridge | Port: " + CONFIG.PORT + " | ID: " + CONFIG.RESTAURANT_ID); });
