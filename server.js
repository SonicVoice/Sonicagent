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

// ═══════════════════════════════════════════════════
// ITEM ID AUTO-CORRECTION — fixes wrong IDs from agent
// Maps item_name to correct POS foodMenuItemId
// ═══════════════════════════════════════════════════

var SIZED_ITEMS = {
  // Cheese Pizzas: keyword → {size: id}
  "cheese pizza": {10:735, 12:736, 14:737, 16:738, 18:739},

  // Specialty Pizzas: keyword → {size: id} (all sizes same ID)
  "deluxe pizza": {10:655,12:655,14:655,16:655,18:655},
  "steak pizza": {10:656,12:656,14:656,16:656,18:656},
  "unique pizza": {10:657,12:657,14:657,16:657,18:657},
  "supreme pizza": {10:658,12:658,14:658,16:658,18:658},
  "veggie pizza": {10:659,12:659,14:659,16:659,18:659},
  "philly cheese steak pizza": {10:660,12:660,14:660,16:660,18:660},
  "hawaiian pizza": {10:661,12:661,14:661,16:661,18:661},
  "new york style pizza": {10:662,12:662,14:662,16:662,18:662},
  "ny style pizza": {10:662,12:662,14:662,16:662,18:662},
  "chicken bacon ranch pizza": {10:663,12:663,14:663,16:663,18:663},
  "buffalo chicken pizza": {10:664,12:664,14:664,16:664,18:664},
  "bbq chicken pizza": {10:666,12:666,14:666,16:666,18:666},
  "meal buster pizza": {10:667,12:667,14:667,16:667,18:667},
  "meat lover pizza": {10:829,12:829,14:829,16:829,18:829},

  // Grilled Subs: keyword → {8: id, 12: id}
  "cheese steak sub": {8:684,12:684},
  "cheesesteak sub": {8:684,12:684},
  "chicken cheese steak sub": {8:685,12:685},
  "chicken cheesesteak sub": {8:685,12:685},
  "cheese burger sub": {8:686,12:686},
  "cheeseburger sub": {8:686,12:686},
  "steak sub": {8:687,12:687},
  "hamburger sub": {8:688,12:688},
  "meat ball sub": {8:689,12:689},
  "meatball sub": {8:689,12:689},
  "turkey burger sub": {8:690,12:690},
  "chicken parmesan sub": {8:691,12:691},
  "chicken parm sub": {8:691,12:691},
  "grilled chicken sub": {8:692,12:692},
  "chicken fillet sub": {8:693,12:693},
  "pizza sub": {8:694,12:694},
  "chilli sub": {8:695,12:695},
  "chili sub": {8:695,12:695},
  "cheese fish sub": {8:801,12:801},
  "crab cake sub": {8:833,12:833},

  // Cold Cut Subs
  "italian cold cut sub": {8:702,12:702},
  "italian hot cut sub": {8:703,12:703},
  "turkey breast sub": {8:704,12:704},
  "ham and cheese sub": {8:705,12:705},
  "ham cheese sub": {8:705,12:705},
  "tuna salad sub": {8:706,12:706},
  "tuna sub": {8:706,12:706},
  "chicago cold cut sub": {8:707,12:707},
  "chicken salad sub": {8:708,12:708},
  "chipotle sub": {8:709,12:709},
  "shrimp salad sub": {8:710,12:710},
  "regular cold cut sub": {8:825,12:825},
  "regular hot cut sub": {8:826,12:826},

  // Special Subs
  "philly cheese steak sub": {8:723,12:723},
  "philly cheesesteak sub": {8:723,12:723},
  "philly chicken sub": {8:724,12:724},
  "cheese steak special sub": {8:725,12:725},
  "cheesesteak special sub": {8:725,12:725},
  "shrimp cheese steak sub": {8:726,12:726},
  "shrimp cheesesteak sub": {8:726,12:726},
  "veggie sub": {8:727,12:727},

  // Buffalo Wings: keyword → {count: id}
  "buffalo wing": {6:579,8:580,9:580,10:581,12:581,18:582,24:583,36:584,48:585,50:586},

  // Whole Wings
  "whole wing": {4:591,6:592,8:593,10:594,12:595,15:596,20:597,30:598},

  // Chicken Nuggets
  "chicken nugget": {6:587,9:588,12:824},

  // Fish Nuggets
  "fish nugget": {5:589,10:590},

  // Chicken Tenders
  "chicken tender": {3:672,5:673,7:674},

  // Seafood
  "tilapia": {2:642,3:643,5:644},
  "cat fish": {2:645,3:646,5:647},
  "catfish": {2:645,3:646,5:647},
  "whiting": {2:648,3:649,5:650},
  "lake trout": {3:651,5:652},
};

var FIXED_ITEMS = {
  // Sandwiches
  "crab cake sandwich": 711,
  "hamburger sandwich": 712, "hamburger 1/4": 712, "quarter pound": 712,
  "cheese burger sandwich": 713, "cheeseburger sandwich": 713, "cheeseburger": 713,
  "turkey burger sandwich": 714, "turkey burger": 714,
  "grilled chicken sandwich": 715,
  "crispy chicken sandwich": 716,
  "fried fish sandwich": 717,
  "cheese fish sandwich": 718, "cheese fish": 718,
  "blt sandwich": 719, "blt": 719,
  "hot dog": 720,
  "grilled shrimp sandwich": 721,
  "fried shrimp sandwich": 722,

  // Wraps
  "grilled chicken caesar wrap": 623, "chicken caesar wrap": 623,
  "veggie wrap": 624,
  "cheese steak wrap": 625, "cheesesteak wrap": 625,
  "chicken cheese steak wrap": 626, "chicken cheesesteak wrap": 626,
  "italian cold cut wrap": 627,
  "cheese burger wrap": 628, "cheeseburger wrap": 628,
  "buffalo chicken wrap": 629,
  "chipotle cheese steak wrap": 630, "chipotle cheesesteak wrap": 630, "chipotle wrap": 630,
  "ranchero chicken wrap": 631, "ranchero wrap": 631,
  "turkey wrap": 812,
  "tuna wrap": 813,
  "shrimp salad wrap": 814,

  // Clubs
  "turkey club": 696,
  "ham club": 697,
  "grilled chicken club": 698, "chicken club": 698,
  "blt club": 699,
  "tuna club": 700,
  "chicken salad club": 701,

  // Salads
  "greek salad": 633,
  "grilled chicken caesar salad": 634, "chicken caesar salad": 634,
  "garden salad": 635,
  "grilled chicken garden salad": 636,
  "grilled chicken salad": 637,
  "crispy chicken garden salad": 638, "crispy chicken salad": 638,
  "chef salad": 639, "chefs salad": 639, "chef's salad": 639,
  "tuna garden salad": 640, "tuna on garden salad": 640, "tuna salad": 640,
  "fried shrimp salad": 641,

  // Gyro
  "chicken gyro platter": 796,
  "lamb gyro platter": 797,
  "chicken gyro": 653,
  "lamb gyro": 654,

  // Seafood Platters
  "jumbo fried shrimp platter": 675, "shrimp platter": 675, "jumbo shrimp": 675,
  "shrimp basket": 676,
  "crab cake platter": 677,
  "lake trout platter": 820,
  "whiting platter": 821,
  "catfish platter": 822, "cat fish platter": 822,
  "tilapia platter": 823,

  // Pasta
  "marinara sauce spaghetti": 815, "marinara spaghetti": 815,
  "marinara sauce lasagna": 816, "marinara lasagna": 816,
  "chicken alfredo pasta": 576, "chicken alfredo": 576,
  "meat sauce spaghetti": 570,
  "meat sauce lasagna": 571,
  "chicken parmesan spaghetti": 572, "chicken parm spaghetti": 572,
  "chicken parmesan lasagna": 817, "chicken parm lasagna": 817,
  "meat ball spaghetti": 573, "meatball spaghetti": 573,
  "meat ball lasagna": 578, "meatball lasagna": 578,
  "mushroom spaghetti": 574,
  "mushroom lasagna": 818,
  "shrimp spaghetti": 575,
  "shrimp alfredo pasta": 577, "shrimp alfredo": 577,
  "shrimp lasagna": 819,

  // Stromboli
  "regular cheese and beef stromboli": 668, "regular stromboli": 668, "cheese and beef stromboli": 668, "beef stromboli": 668,
  "veggie stromboli": 669,
  "philly cheese steak stromboli": 670, "philly cheesesteak stromboli": 670, "philly stromboli": 670,
  "chicken stromboli": 671,

  // Quesadillas
  "chicken breast quesadilla": 678, "chicken quesadilla": 678,
  "buffalo chicken quesadilla": 679,
  "steak quesadilla": 680,
  "veggie quesadilla": 681,
  "shrimp quesadilla": 682,

  // Sides
  "french fries": 607, "fries": 607, "small fries": 607, "regular fries": 607,
  "large french fries": 830, "large fries": 830,
  "western fries small": 614, "western fries sm": 614,
  "western fries large": 608, "western fries lg": 608, "western fries": 608,
  "fries w/ gravy": 609, "fries with gravy": 609, "gravy fries": 609,
  "fries w/ cheese": 811, "fries with cheese": 811, "cheese fries": 811,
  "fries w/ nacho": 611, "fries with nacho": 611, "nacho fries": 611,
  "fries w/ mozzarella": 612, "fries with mozzarella": 612, "mozzarella fries": 612,
  "pizza fries": 615,
  "crazy fries": 613,
  "onion rings": 618,
  "mozzarella sticks": 616, "mozz sticks": 616,
  "breaded mushrooms": 617,
  "breadsticks w/ cheese": 799, "breadsticks with cheese": 799,
  "breadsticks": 620,
  "garlic bread w/ cheese": 622, "garlic bread with cheese": 622,
  "garlic bread": 621,
  "cole slaw": 619, "coleslaw": 619,
  "bag chips plain": 610, "chips plain": 610, "plain chips": 610,
  "bag chips bbq": 810, "chips bbq": 810, "bbq chips": 810,
  "nacho cheese cup": 848,
  "gravy cup": 849,

  // Desserts
  "sweet potato pie": 600,
  "cheese cake": 601, "cheesecake": 601,
  "chocolate cake": 602,
  "carrot cake": 603,
  "lemon cake": 604,
  "strawberry cheese cake": 605, "strawberry cheesecake": 605,
  "red velvet cake": 606, "red velvet": 606,
  "banana pudding": 832,
  "bean pie": 851,

  // Beverages
  "can soda": 728, "soda can": 728, "can of soda": 728,
  "2 liter soda": 790, "two liter soda": 790, "2 liter": 790, "2-liter": 790, "two liter": 790,
  "spring water": 732, "water": 732, "bottled water": 732,
  "16oz lemonade": 733, "lemonade": 733,
  "apple juice": 729,
  "orange juice": 730,
  "cranberry juice": 731,
};

// Combo deal name → ID
var DEAL_IDS = {
  "double deal": {12:786, 14:787, 16:788},
  "3 pizza special": {14:777, 16:778},
  "three pizza special": {14:777, 16:778},
  "3-pizza special": {14:777, 16:778},
  "pizza and wings": {12:781, 14:782, 16:783},
  "pizza wings": {12:781, 14:782, 16:783},
  "family deal": {12:781, 14:782, 16:783},
  "pizza and sub": {12:784, 14:794, 16:744},
  "pizza sub combo": {12:784, 14:794, 16:744},
  "pizza sub deal": {12:784, 14:794, 16:744},
  "combo deal": {12:769, 14:770},
  "pizza sub wings": {12:769, 14:770},
  "wings and sub": {0:771}, "wings sub combo": {0:771},
  "sub combo": {8:772, 12:774}, "sub deal": {8:772, 12:774},
  "2 sub combo": {0:773}, "two sub combo": {0:773},
  "3 sub combo": {0:780}, "three sub combo": {0:780},
  "6 buffalo wings combo": {0:840}, "wings special buffalo": {0:840},
  "4 whole wings combo": {0:839}, "wings special whole": {0:839},
  "chicken box whole": {0:838},
  "chicken box buffalo": {0:847},
  "burger combo": {0:793}, "cheeseburger combo": {0:793},
  "fish combo": {0:831}, "cheese fish combo": {0:831},
  "party deal": {0:776},
  "fish and wings deal": {0:775}, "fish wings deal": {0:775},
};

function extractNumber(str) {
  var m = str.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function fixItemId(item) {
  var nm = (item.item_name || item.component_name || item.name || "").toLowerCase()
    .replace(/[""\-]/g, " ").replace(/\s+/g, " ").trim();
  var num = extractNumber(nm);

  // 1. Try combo deal names first
  if (item.is_combo) {
    for (var deal in DEAL_IDS) {
      if (nm.indexOf(deal) !== -1) {
        var dmap = DEAL_IDS[deal];
        // Try to find pizza size from components
        var pSize = 0;
        if (item.components) {
          for (var ci = 0; ci < item.components.length; ci++) {
            var cn = (item.components[ci].component_name || "").toLowerCase();
            if (cn.indexOf("pizza") !== -1) { pSize = extractNumber(cn); break; }
          }
        }
        if (!pSize) pSize = num;
        var did = dmap[pSize] || dmap[0] || null;
        if (did) { item.item_id = String(did); console.log("ID-FIX: " + nm + " → " + did); return; }
      }
    }
  }

  // 2. Try sized items (pizza, subs, wings, nuggets, fish)
  for (var key in SIZED_ITEMS) {
    if (nm.indexOf(key) !== -1) {
      var smap = SIZED_ITEMS[key];
      // Try extracted number first, then common size aliases
      var sid = smap[num] || null;
      if (!sid) {
        if (nm.indexOf("small") !== -1 || nm.indexOf("sm ") !== -1) sid = smap[10] || smap[8] || smap[6] || smap[3] || smap[2];
        else if (nm.indexOf("medium") !== -1 || nm.indexOf("med ") !== -1) sid = smap[12] || smap[9];
        else if (nm.indexOf("large") !== -1 || nm.indexOf("lrg") !== -1) sid = smap[14];
        else if (nm.indexOf("x-large") !== -1 || nm.indexOf("xl ") !== -1 || nm.indexOf("extra large") !== -1) sid = smap[16];
        else if (nm.indexOf("xx-large") !== -1 || nm.indexOf("xxl") !== -1) sid = smap[18];
        else if (nm.indexOf("half") !== -1) sid = smap[8];
        else if (nm.indexOf("whole") !== -1 && smap[12]) sid = smap[12];
      }
      if (sid) { item.item_id = String(sid); console.log("ID-FIX: " + nm + " → " + sid); return; }
    }
  }

  // 3. Try fixed items (single-size items)
  for (var fkey in FIXED_ITEMS) {
    if (nm.indexOf(fkey) !== -1) {
      item.item_id = String(FIXED_ITEMS[fkey]);
      console.log("ID-FIX: " + nm + " → " + FIXED_ITEMS[fkey]);
      return;
    }
  }

  // 4. No match — clear bad ID so POS uses itemName instead
  if (item.item_id && !/^\d+$/.test(String(item.item_id))) {
    console.log("ID-CLEAR: " + nm + " had non-numeric ID: " + item.item_id);
    item.item_id = "";
  } else {
    console.log("ID-KEEP: " + nm + " → " + (item.item_id || "none"));
  }
}

function fixAllIds(order) {
  if (!order.items) return;
  for (var i = 0; i < order.items.length; i++) {
    var item = order.items[i];
    fixItemId(item);
    // Fix component IDs too
    if (item.components && item.components.length > 0) {
      for (var c = 0; c < item.components.length; c++) {
        fixItemId(item.components[c]);
      }
    }
  }
}

// Kitchen printer routing — explicit item IDs
// Kitchen 2 (printKitchen2): Pizzas and Stromboli
// Kitchen 1 (printKitchen): Everything else
// Tags are OMITTED (not set to N) for the printer that doesn't apply

// All Kitchen 2 item IDs:
var KITCHEN2_IDS = {
  // Cheese Pizzas
  735:1, 736:1, 737:1, 738:1, 739:1,
  // Specialty Pizzas
  655:1, 656:1, 657:1, 658:1, 659:1, 660:1, 661:1, 662:1, 663:1, 664:1, 666:1, 667:1, 829:1,
  // Stromboli
  668:1, 669:1, 670:1, 671:1
};

function isKitchen2(item) {
  var id = parseInt(item.item_id || 0);
  if (KITCHEN2_IDS[id]) return true;
  // Fallback: check category
  var cat = (item.category || "").toLowerCase();
  if (cat === "pizzas" || cat === "stromboli") return true;
  // Fallback: check name
  var nm = (item.item_name || item.name || item.component_name || "").toLowerCase();
  if (nm.indexOf("pizza") !== -1 || nm.indexOf("stromboli") !== -1) return true;
  return false;
}

function getComboKitchenTags(item) {
  var hasK1 = false, hasK2 = false;
  if (item.components && item.components.length > 0) {
    for (var c = 0; c < item.components.length; c++) {
      if (isKitchen2(item.components[c])) hasK2 = true;
      else hasK1 = true;
    }
  }
  if (!hasK1 && !hasK2) { hasK1 = true; }
  // Only send Y tags, omit the other printer entirely
  var tags = "";
  if (hasK1) tags += "<printKitchen>Y</printKitchen>";
  if (hasK2) tags += "<printKitchen2>Y</printKitchen2>";
  return tags;
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
  if (isKitchen2(item)) {
    o += "<printKitchen2>Y</printKitchen2>";
  } else {
    o += "<printKitchen>Y</printKitchen>";
  }

  if (item.modifiers && item.modifiers.length > 0) {
    o += "<Requirements>";
    for (var i = 0; i < item.modifiers.length; i++) {
      var mod = item.modifiers[i];
      o += "<Requirement>";
      if (mod.group) o += "<groupMame>" + X(mod.group) + "</groupMame>";
      o += NT + X(mod.name || mod) + NTC;
      o += "<quantity>1</quantity>";
      o += "<price>0.00</price>";
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
  if (item.item_id && /^\d+$/.test(String(item.item_id))) {
    o += "<foodMenuItemId>" + X(item.item_id) + "</foodMenuItemId>";
  }
  o += "<quantity>1</quantity>";
  o += "<unitPrice>" + parseFloat(item.unit_price || item.price || 0).toFixed(2) + "</unitPrice>";
  o += getComboKitchenTags(item);

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
          o += "<price>0.00</price>";
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
      if (!comp2.item_id || !/^\d+$/.test(String(comp2.item_id))) continue;

      o += "<OrderLineItem>";
      o += "<itemName>" + X(comp2.component_name) + "</itemName>";
      if (comp2.special_instructions) {
        o += "<additionalRequirements>" + X(comp2.special_instructions) + "</additionalRequirements>";
      }
      o += "<foodMenuItemId>" + X(comp2.item_id) + "</foodMenuItemId>";
      o += "<quantity>1</quantity>";
      o += "<unitPrice>0.00</unitPrice>";
      if (isKitchen2(comp2)) {
        o += "<printKitchen2>Y</printKitchen2>";
      } else {
        o += "<printKitchen>Y</printKitchen>";
      }

      if (comp2.modifiers && comp2.modifiers.length > 0) {
        o += "<Requirements>";
        for (var m2 = 0; m2 < comp2.modifiers.length; m2++) {
          var mod2 = comp2.modifiers[m2];
          o += "<Requirement>";
          if (mod2.group) o += "<groupMame>" + X(mod2.group) + "</groupMame>";
          o += NT + X(mod2.name) + NTC;
          o += "<quantity>1</quantity>";
          o += "<price>0.00</price>";
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
  // Fix all item IDs before building XML
  fixAllIds(order);
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
    var cardNum = (data.card_number || "").replace(/[\s\-]/g, "");
    var exp = (data.expiration || "").replace(/[\s\/\-]/g, "");
    // Convert "1228" or "122028" to "1228" (MMYY)
    if (exp.length === 6) exp = exp.substring(0, 2) + exp.substring(4, 6);
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

    var r = await fetch(USAEPAY_URL + "/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body),
    });

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

    // Default city/state from env vars (set per restaurant)
    var defaultCity = process.env.DEFAULT_CITY || "Baltimore";
    var defaultState = process.env.DEFAULT_STATE || "MD";
    var lowerAddr = addr.toLowerCase();
    var hasCity = lowerAddr.indexOf(defaultCity.toLowerCase()) !== -1;

    // Always try with default city/state first, then as-is
    var clean = addr.replace(/\s+/g, " ").trim();
    var variations = [];
    if (!hasCity) {
      variations.push(clean + ", " + defaultCity + ", " + defaultState);
      variations.push(clean + ", " + defaultState);
    }
    variations.push(clean);
    variations.push(clean + ", USA");

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
    endpoints: ["POST /retell/function/submit_order", "POST /retell/function/verify_address", "POST /retell/function/process_payment", "POST /retell/function/get_caller_id",
      "GET /orders (clean receipt list)", "GET /order/:ref (single receipt)", "GET /payment-log",
      "GET /test-order", "GET /test-combo", "GET /test-delivery", "GET /test-payment", "GET /debug"] });
});

app.listen(CONFIG.PORT, function () { console.log("V15 POS Bridge | Port: " + CONFIG.PORT + " | ID: " + CONFIG.RESTAURANT_ID); });
