// ═══════════════════════════════════════════════════════════════
// DEMO PIZZA — Server-Driven Voice Orchestrator v2.0
// Architecture: Retell LLM extracts → Server decides → LLM speaks
// ═══════════════════════════════════════════════════════════════

var express = require("express");
// fetch is built-in to Node.js v18+
var app = express();
app.use(express.json({ limit: "5mb" }));

var { Pool } = require("pg");
var pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ═══════════════════════════════════════════════════════════════
// SESSION STORE — per-call state, auto-expires after 30 min
// ═══════════════════════════════════════════════════════════════
var SESSIONS = {};
var SESSION_TTL = 30 * 60 * 1000;

function getSession(callId) {
  if (!SESSIONS[callId]) {
    SESSIONS[callId] = {
      id: callId,
      state: "greeting",
      order_type: "pickup",
      basket: [],
      pending_items: [],       // items mentioned but not fully collected
      current_item: null,      // item being collected right now
      missing_fields: [],      // what we need to ask for current_item
      declined_deals: [],
      suggested_deals: [],
      customer_name: "",
      customer_phone: "",
      delivery_address: "",
      subtotal: 0,
      tax: 0,
      delivery_fee: 0,
      total: 0,
      payment_method: "cash",
      payment_ref: "",
      last_say: "",
      created: Date.now()
    };
  }
  SESSIONS[callId].touched = Date.now();
  return SESSIONS[callId];
}

// Cleanup expired sessions every 5 min
setInterval(function () {
  var now = Date.now();
  for (var k in SESSIONS) {
    if (now - SESSIONS[k].touched > SESSION_TTL) delete SESSIONS[k];
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// MENU CACHE — loaded from database, hot-reloadable
// ═══════════════════════════════════════════════════════════════
var MENU = {
  pizzas: [],        // {name, id, prices: {10:p, 12:p, 14:p, 16:p, 18:p}, keywords:[]}
  specialty: [],     // {name, id, prices: {10:p, 12:p, 14:p, 16:p, 18:p}, keywords:[]}
  subs: [],          // {name, id, p8, p12, keywords:[], premium:bool}
  sandwiches: [],    // {name, id, price, keywords:[]}
  wraps: [],
  clubs: [],
  buffalo_wings: [], // {qty, id, price}
  whole_wings: [],
  nuggets: [],
  fish_nuggets: [],
  tenders: [],
  salads: [],
  gyros: [],
  pasta: [],
  stromboli: [],
  quesadillas: [],
  seafood: [],
  platters: [],
  sides: [],
  desserts: [],
  beverages: [],
  deals: {},         // {deal_type: {sizes: {sz: {id, price}}, ...}}
  toppings: {},      // {size: {name: {id, price}}}
  topping_prices: {},
  sub_fixins: {},
  cheese_options: {},
  wing_flavors: {},
  wing_dressings: {},
  soda_flavors: {},
  salad_dressings: {},
  tender_sauces: {},
  loaded: false
};

async function loadMenu() {
  try {
    // ── PIZZA PRICES ──
    MENU.pizzas = [{name:"Cheese Pizza", keywords:["cheese pizza","plain pizza","just cheese"],
      prices:{10:8.99, 12:10.99, 14:11.99, 16:13.99, 18:14.99},
      ids:{10:735, 12:736, 14:737, 16:738, 18:739}}];
    
    // ── SPECIALTY PIZZAS ──
    MENU.specialty = [
      {name:"Deluxe",id:655,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["deluxe"]},
      {name:"Steak",id:656,prices:{10:13.99,12:16.99,14:18.99,16:20.99,18:22.99},keywords:["steak pizza"]},
      {name:"Unique",id:657,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["unique"]},
      {name:"Supreme",id:658,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["supreme"]},
      {name:"Veggie",id:659,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["veggie pizza"]},
      {name:"Philly CS",id:660,prices:{10:13.99,12:16.99,14:18.99,16:20.99,18:22.99},keywords:["philly cheese steak pizza"]},
      {name:"Hawaiian",id:661,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["hawaiian"]},
      {name:"NY Style",id:662,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["new york","ny style"]},
      {name:"Chicken Bacon Ranch",id:663,prices:{10:13.99,12:16.99,14:18.99,16:20.99,18:22.99},keywords:["chicken bacon ranch","cbr"]},
      {name:"Buffalo Chicken",id:664,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["buffalo chicken pizza"]},
      {name:"BBQ Chicken",id:666,prices:{10:12.99,12:15.99,14:17.99,16:19.99,18:21.99},keywords:["bbq chicken pizza"]},
      {name:"Meal Buster",id:667,prices:{10:14.99,12:17.99,14:19.99,16:22.99,18:24.99},keywords:["meal buster"]},
      {name:"Meat Lover",id:829,prices:{10:13.99,12:16.99,14:18.99,16:20.99,18:22.99},keywords:["meat lover"]}
    ];

    // ── SUBS ──
    MENU.subs = [
      {name:"Shrimp Cheese Steak Sub",id:726,p8:9.99,p12:14.49,premium:true,keywords:["shrimp cheese steak","shrimp cheesesteak","shrimp cs"]},
      {name:"Philly Cheese Steak Sub",id:723,p8:9.49,p12:13.99,premium:true,keywords:["philly cheese steak","philly cheesesteak","philly cs","philly sub"]},
      {name:"Philly Chicken Sub",id:724,p8:9.49,p12:13.99,premium:true,keywords:["philly chicken"]},
      {name:"Cheese Steak Special Sub",id:725,p8:9.49,p12:13.49,premium:true,keywords:["cheese steak special","cs special"]},
      {name:"Shrimp Salad Sub",id:710,p8:8.99,p12:12.99,premium:true,keywords:["shrimp salad sub","shrimp salad"]},
      {name:"Cheese Steak Sub",id:684,p8:8.49,p12:12.49,premium:false,keywords:["cheese steak","cheesesteak","cs sub"]},
      {name:"Chicken Cheese Steak Sub",id:685,p8:8.49,p12:12.49,premium:false,keywords:["chicken cheese steak","chicken cheesesteak"]},
      {name:"Cheese Burger Sub",id:686,p8:8.49,p12:12.49,premium:false,keywords:["cheese burger sub","cheeseburger sub"]},
      {name:"Cheese Fish Sub",id:801,p8:8.49,p12:12.49,premium:false,keywords:["cheese fish sub","cheese fish","fish sub"]},
      {name:"Steak Sub",id:687,p8:8.49,p12:12.49,premium:false,keywords:["steak sub"]},
      {name:"Grilled Chicken Sub",id:692,p8:8.49,p12:12.49,premium:false,keywords:["grilled chicken sub","chicken sub"]},
      {name:"Chicken Fillet Sub",id:693,p8:8.49,p12:12.49,premium:false,keywords:["chicken fillet"]},
      {name:"Chicken Parmesan Sub",id:691,p8:8.49,p12:12.49,premium:false,keywords:["chicken parmesan","chicken parm"]},
      {name:"Crab Cake Sub",id:833,p8:9.49,p12:13.49,premium:false,keywords:["crab cake sub","crab sub"]},
      {name:"Veggie Sub",id:727,p8:8.49,p12:12.49,premium:false,keywords:["veggie sub"]},
      {name:"Hamburger Sub",id:688,p8:7.99,p12:11.99,premium:false,keywords:["hamburger sub"]},
      {name:"Meat Ball Sub",id:689,p8:7.99,p12:11.99,premium:false,keywords:["meatball","meat ball"]},
      {name:"Turkey Burger Sub",id:690,p8:7.99,p12:11.99,premium:false,keywords:["turkey burger sub"]},
      {name:"Pizza Sub",id:694,p8:7.99,p12:11.99,premium:false,keywords:["pizza sub"]},
      {name:"Chilli Sub",id:695,p8:7.99,p12:11.99,premium:false,keywords:["chilli sub","chili sub"]},
      {name:"Italian Cold Cut Sub",id:702,p8:7.99,p12:11.99,premium:false,keywords:["italian cold cut","italian cold"]},
      {name:"Italian Hot Cut Sub",id:703,p8:7.99,p12:11.99,premium:false,keywords:["italian hot cut","italian hot"]},
      {name:"Turkey Breast Sub",id:704,p8:7.99,p12:11.99,premium:false,keywords:["turkey breast","turkey sub"]},
      {name:"Ham and Cheese Sub",id:705,p8:7.99,p12:11.99,premium:false,keywords:["ham and cheese","ham cheese","ham sub"]},
      {name:"Tuna Salad Sub",id:706,p8:7.99,p12:11.99,premium:false,keywords:["tuna salad sub","tuna sub"]},
      {name:"Chicago Cold Cut Sub",id:707,p8:8.49,p12:12.49,premium:false,keywords:["chicago cold cut","chicago sub"]},
      {name:"Chicken Salad Sub",id:708,p8:7.99,p12:11.99,premium:false,keywords:["chicken salad sub"]},
      {name:"Chipotle Sub",id:709,p8:8.49,p12:12.49,premium:false,keywords:["chipotle sub","chipotle"]},
      {name:"Regular Cold Cut Sub",id:825,p8:7.49,p12:10.99,premium:false,keywords:["regular cold cut","american cold cut"]},
      {name:"Regular Hot Cut Sub",id:826,p8:7.49,p12:10.99,premium:false,keywords:["regular hot cut","american hot cut"]}
    ];

    // ── SANDWICHES ──
    MENU.sandwiches = [
      {name:"Crab Cake Sandwich",id:711,price:5.99,keywords:["crab cake sandwich"]},
      {name:"Hamburger Sandwich",id:712,price:4.99,keywords:["hamburger sandwich","quarter pound"]},
      {name:"Cheese Burger Sandwich",id:713,price:4.99,keywords:["cheese burger sandwich","cheeseburger sandwich","cheeseburger"]},
      {name:"Turkey Burger Sandwich",id:714,price:4.99,keywords:["turkey burger sandwich"]},
      {name:"Grilled Chicken Sandwich",id:715,price:5.99,keywords:["grilled chicken sandwich"]},
      {name:"Crispy Chicken Sandwich",id:716,price:5.99,keywords:["crispy chicken sandwich"]},
      {name:"Fried Fish Sandwich",id:717,price:5.99,keywords:["fried fish sandwich"]},
      {name:"Cheese Fish Sandwich",id:718,price:5.99,keywords:["cheese fish sandwich"]},
      {name:"BLT Sandwich",id:719,price:5.99,keywords:["blt sandwich","blt"]},
      {name:"Hot Dog",id:720,price:5.99,keywords:["hot dog"]},
      {name:"Grilled Shrimp Sandwich",id:721,price:6.99,keywords:["grilled shrimp sandwich"]},
      {name:"Fried Shrimp Sandwich",id:722,price:8.99,keywords:["fried shrimp sandwich"]}
    ];

    // ── WRAPS ──
    MENU.wraps = [
      {name:"Grilled Chicken Caesar Wrap",id:623,price:9.49,keywords:["chicken caesar wrap"]},
      {name:"Veggie Wrap",id:624,price:9.49,keywords:["veggie wrap"]},
      {name:"Cheese Steak Wrap",id:625,price:9.49,keywords:["cheese steak wrap"]},
      {name:"Chicken Cheese Steak Wrap",id:626,price:9.49,keywords:["chicken cheese steak wrap"]},
      {name:"Italian Cold Cut Wrap",id:627,price:9.49,keywords:["italian cold cut wrap"]},
      {name:"Cheese Burger Wrap",id:628,price:9.49,keywords:["cheese burger wrap"]},
      {name:"Buffalo Chicken Wrap",id:629,price:9.49,keywords:["buffalo chicken wrap"]},
      {name:"Chipotle CS Wrap",id:630,price:7.99,keywords:["chipotle wrap"]},
      {name:"Ranchero Chicken Wrap",id:631,price:9.49,keywords:["ranchero wrap"]},
      {name:"Turkey Wrap",id:812,price:9.49,keywords:["turkey wrap"]},
      {name:"Tuna Wrap",id:813,price:9.49,keywords:["tuna wrap"]},
      {name:"Shrimp Salad Wrap",id:814,price:11.99,keywords:["shrimp salad wrap"]}
    ];

    // ── CLUBS ──
    MENU.clubs = [
      {name:"Turkey Club",id:696,price:10.99,keywords:["turkey club"]},
      {name:"Ham Club",id:697,price:10.99,keywords:["ham club"]},
      {name:"Grilled Chicken Club",id:698,price:8.99,keywords:["grilled chicken club","chicken club"]},
      {name:"BLT Club",id:699,price:10.99,keywords:["blt club"]},
      {name:"Tuna Club",id:700,price:10.99,keywords:["tuna club"]},
      {name:"Chicken Salad Club",id:701,price:9.99,keywords:["chicken salad club"]}
    ];

    // ── WINGS ──
    MENU.buffalo_wings = [
      {qty:6,id:579,price:8.99},{qty:9,id:580,price:12.99},{qty:12,id:581,price:14.99},
      {qty:18,id:582,price:21.99},{qty:24,id:583,price:25.99},{qty:36,id:584,price:36.99},
      {qty:48,id:585,price:46.99},{qty:50,id:586,price:48.99}
    ];
    MENU.whole_wings = [
      {qty:4,id:591,price:9.99},{qty:6,id:592,price:12.99},{qty:8,id:593,price:15.99},
      {qty:10,id:594,price:15.99},{qty:12,id:595,price:24.99},{qty:15,id:596,price:28.99},
      {qty:20,id:597,price:36.99},{qty:30,id:598,price:50.99}
    ];

    // ── TENDERS / NUGGETS ──
    MENU.tenders = [{qty:3,id:672,price:7.49},{qty:5,id:673,price:10.49},{qty:7,id:674,price:12.49}];
    MENU.nuggets = [{qty:6,id:587,price:5.99},{qty:9,id:588,price:6.99},{qty:12,id:824,price:8.99}];
    MENU.fish_nuggets = [{qty:5,id:589,price:7.99},{qty:10,id:590,price:12.99}];

    // ── SALADS ──
    MENU.salads = [
      {name:"Garden Salad",id:635,price:6.99,keywords:["garden salad","garden"]},
      {name:"Caesar Salad",id:634,price:7.99,keywords:["caesar salad"]},
      {name:"Greek Salad",id:633,price:9.99,keywords:["greek salad","greek"]},
      {name:"Grilled Chicken Garden Salad",id:636,price:9.99,keywords:["chicken garden salad"]},
      {name:"Grilled Chicken Salad",id:637,price:9.99,keywords:["grilled chicken salad"]},
      {name:"Crispy Chicken Salad",id:638,price:9.99,keywords:["crispy chicken salad"]},
      {name:"Chef Salad",id:639,price:9.99,keywords:["chef salad"]},
      {name:"Tuna on Garden Salad",id:640,price:9.99,keywords:["tuna salad","tuna garden"]},
      {name:"Fried Shrimp Salad",id:641,price:10.99,keywords:["fried shrimp salad","shrimp salad"]}
    ];

    // ── GYROS ──
    MENU.gyros = [
      {name:"Chicken Gyro",id:653,price:9.49,keywords:["chicken gyro"]},
      {name:"Lamb Gyro",id:654,price:9.49,keywords:["lamb gyro"]},
      {name:"Chicken Gyro Platter",id:796,price:10.49,keywords:["chicken gyro platter"]},
      {name:"Lamb Gyro Platter",id:797,price:10.49,keywords:["lamb gyro platter"]}
    ];

    // ── PASTA ──
    MENU.pasta = [
      {name:"Marinara Spaghetti",id:815,price:8.99,keywords:["marinara spaghetti"]},
      {name:"Marinara Lasagna",id:816,price:9.99,keywords:["marinara lasagna"]},
      {name:"Chicken Alfredo",id:576,price:9.99,keywords:["chicken alfredo"]},
      {name:"Meat Sauce Spaghetti",id:570,price:10.99,keywords:["meat sauce spaghetti"]},
      {name:"Meat Sauce Lasagna",id:571,price:11.99,keywords:["meat sauce lasagna"]},
      {name:"Chicken Parm Spaghetti",id:572,price:10.99,keywords:["chicken parm spaghetti","chicken parmesan spaghetti"]},
      {name:"Chicken Parm Lasagna",id:817,price:11.99,keywords:["chicken parm lasagna"]},
      {name:"Meatball Spaghetti",id:573,price:10.99,keywords:["meatball spaghetti"]},
      {name:"Meatball Lasagna",id:578,price:11.99,keywords:["meatball lasagna"]},
      {name:"Mushroom Spaghetti",id:574,price:10.99,keywords:["mushroom spaghetti"]},
      {name:"Mushroom Lasagna",id:818,price:11.99,keywords:["mushroom lasagna"]},
      {name:"Shrimp Spaghetti",id:575,price:12.99,keywords:["shrimp spaghetti"]},
      {name:"Shrimp Alfredo",id:577,price:12.99,keywords:["shrimp alfredo"]},
      {name:"Shrimp Lasagna",id:819,price:13.99,keywords:["shrimp lasagna"]}
    ];

    // ── STROMBOLI ──
    MENU.stromboli = [
      {name:"Regular Stromboli",id:668,price:9.99,keywords:["regular stromboli","beef stromboli"]},
      {name:"Veggie Stromboli",id:669,price:13.99,keywords:["veggie stromboli"]},
      {name:"Philly CS Stromboli",id:670,price:14.99,keywords:["philly stromboli"]},
      {name:"Chicken Stromboli",id:671,price:14.99,keywords:["chicken stromboli"]}
    ];

    // ── QUESADILLAS ──
    MENU.quesadillas = [
      {name:"Chicken Quesadilla",id:678,price:10.99,keywords:["chicken quesadilla"]},
      {name:"Buffalo Chicken Quesadilla",id:679,price:8.99,keywords:["buffalo chicken quesadilla"]},
      {name:"Steak Quesadilla",id:680,price:10.99,keywords:["steak quesadilla"]},
      {name:"Veggie Quesadilla",id:681,price:10.99,keywords:["veggie quesadilla"]},
      {name:"Shrimp Quesadilla",id:682,price:11.99,keywords:["shrimp quesadilla"]}
    ];

    // ── SEAFOOD ──
    MENU.seafood = [
      {name:"2pc Tilapia",id:642,price:10.99,keywords:["2 tilapia"]},
      {name:"3pc Tilapia",id:643,price:13.99,keywords:["3 tilapia"]},
      {name:"5pc Tilapia",id:644,price:19.99,keywords:["5 tilapia"]},
      {name:"2pc Catfish",id:645,price:9.99,keywords:["2 catfish"]},
      {name:"3pc Catfish",id:646,price:13.99,keywords:["3 catfish"]},
      {name:"5pc Catfish",id:647,price:19.99,keywords:["5 catfish"]},
      {name:"2pc Whiting",id:648,price:9.99,keywords:["2 whiting"]},
      {name:"3pc Whiting",id:649,price:13.99,keywords:["3 whiting"]},
      {name:"5pc Whiting",id:650,price:19.99,keywords:["5 whiting"]},
      {name:"3pc Lake Trout",id:651,price:13.99,keywords:["3 lake trout","lake trout"]},
      {name:"5pc Lake Trout",id:652,price:19.99,keywords:["5 lake trout"]}
    ];

    // ── PLATTERS ──
    MENU.platters = [
      {name:"Jumbo Fried Shrimp Platter",id:675,price:12.99,keywords:["shrimp platter","jumbo shrimp"]},
      {name:"Shrimp Basket",id:676,price:9.99,keywords:["shrimp basket"]},
      {name:"Crab Cake Platter",id:677,price:12.99,keywords:["crab cake platter","crab platter"]},
      {name:"Lake Trout Platter",id:820,price:11.99,keywords:["trout platter"]},
      {name:"Whiting Platter",id:821,price:10.99,keywords:["whiting platter"]},
      {name:"Catfish Platter",id:822,price:11.99,keywords:["catfish platter"]},
      {name:"Tilapia Platter",id:823,price:11.99,keywords:["tilapia platter"]}
    ];

    // ── SIDES ──
    MENU.sides = [
      {name:"French Fries",id:607,price:2.99,keywords:["french fries","fries","regular fries"]},
      {name:"Large French Fries",id:830,price:4.49,keywords:["large fries"]},
      {name:"Western Fries Small",id:614,price:3.49,keywords:["western small","small western"]},
      {name:"Western Fries",id:608,price:5.49,keywords:["western fries","western"]},
      {name:"Gravy Fries",id:609,price:4.49,keywords:["gravy fries"]},
      {name:"Cheese Fries",id:811,price:4.49,keywords:["cheese fries"]},
      {name:"Nacho Fries",id:611,price:4.49,keywords:["nacho fries"]},
      {name:"Mozzarella Fries",id:612,price:4.49,keywords:["mozzarella fries","mozz fries"]},
      {name:"Pizza Fries",id:615,price:4.49,keywords:["pizza fries"]},
      {name:"Crazy Fries",id:613,price:4.49,keywords:["crazy fries"]},
      {name:"Onion Rings",id:618,price:5.99,keywords:["onion rings","rings"]},
      {name:"Mozzarella Sticks",id:616,price:6.49,keywords:["mozzarella sticks","mozz sticks"]},
      {name:"Breaded Mushrooms",id:617,price:5.99,keywords:["breaded mushrooms","fried mushrooms"]},
      {name:"Breadsticks",id:620,price:3.99,keywords:["breadsticks"]},
      {name:"Cheese Breadsticks",id:799,price:4.99,keywords:["cheese breadsticks"]},
      {name:"Garlic Bread",id:621,price:2.99,keywords:["garlic bread"]},
      {name:"Garlic Bread w Cheese",id:622,price:3.99,keywords:["garlic bread with cheese","cheesy garlic bread"]},
      {name:"Cole Slaw",id:619,price:2.49,keywords:["coleslaw","cole slaw","slaw"]},
      {name:"Chips Plain",id:610,price:1.49,keywords:["chips","plain chips"]},
      {name:"Chips BBQ",id:810,price:1.49,keywords:["bbq chips"]},
      {name:"Nacho Cheese Cup",id:848,price:1.99,keywords:["nacho cheese"]},
      {name:"Gravy Cup",id:849,price:1.49,keywords:["gravy","side of gravy"]}
    ];

    // ── DESSERTS ──
    MENU.desserts = [
      {name:"Sweet Potato Pie",id:600,price:3.99,keywords:["sweet potato","potato pie"]},
      {name:"Cheese Cake",id:601,price:3.99,keywords:["cheesecake","cheese cake"]},
      {name:"Chocolate Cake",id:602,price:3.99,keywords:["chocolate cake","chocolate"]},
      {name:"Carrot Cake",id:603,price:3.99,keywords:["carrot cake"]},
      {name:"Lemon Cake",id:604,price:3.99,keywords:["lemon cake"]},
      {name:"Strawberry Cheesecake",id:605,price:3.99,keywords:["strawberry cheesecake","strawberry"]},
      {name:"Red Velvet Cake",id:606,price:3.99,keywords:["red velvet"]},
      {name:"Banana Pudding",id:832,price:3.99,keywords:["banana pudding","pudding"]},
      {name:"Bean Pie",id:851,price:3.99,keywords:["bean pie"]}
    ];

    // ── BEVERAGES ──
    MENU.beverages = [
      {name:"Can Soda",id:728,price:1.00,keywords:["can soda","soda","pop"]},
      {name:"2 Liter Soda",id:790,price:3.49,keywords:["2 liter","two liter","2l"]},
      {name:"Spring Water",id:732,price:1.49,keywords:["water","spring water"]},
      {name:"Lemonade",id:733,price:2.49,keywords:["lemonade"]},
      {name:"Apple Juice",id:729,price:1.99,keywords:["apple juice"]},
      {name:"Orange Juice",id:730,price:1.99,keywords:["orange juice","oj"]},
      {name:"Cranberry Juice",id:731,price:1.99,keywords:["cranberry juice"]}
    ];

    // ── TOPPING PRICES BY SIZE ──
    MENU.topping_prices = {
      10:{full:1.00,half:0.50,shrimp:1.50,anchovy:1.50},
      12:{full:1.50,half:0.75,shrimp:2.00,anchovy:2.00},
      14:{full:2.00,half:1.00,shrimp:2.00,anchovy:2.00},
      16:{full:2.50,half:1.25,shrimp:3.50,anchovy:3.50},
      18:{full:3.00,half:1.50,shrimp:4.00,anchovy:4.00}
    };

    // ── TOPPING IDS BY SIZE ──
    MENU.topping_ids = {
      10:{ground_beef:749,ham:750,sausage:751,pepperoni:752,black_olives:753,jalapenos:754,green_peppers:755,mushrooms:756,onions:757,chicken:758,pineapple:759,sweet_peppers:760,banana_peppers:761,broccoli:762,spinach:763,bacon:764,extra_cheese:765,tomatoes:766,shrimp:854,anchovy:855},
      12:{ground_beef:940,ham:941,sausage:942,pepperoni:943,black_olives:944,jalapenos:945,green_peppers:946,mushrooms:947,onions:948,chicken:949,pineapple:950,sweet_peppers:951,banana_peppers:952,broccoli:953,spinach:954,bacon:955,extra_cheese:956,tomatoes:957,shrimp:961,anchovy:962},
      14:{ground_beef:963,ham:964,sausage:965,pepperoni:966,black_olives:967,jalapenos:968,green_peppers:969,mushrooms:970,onions:971,chicken:972,pineapple:973,sweet_peppers:974,banana_peppers:975,broccoli:976,spinach:977,bacon:978,extra_cheese:979,tomatoes:980,shrimp:984,anchovy:985},
      16:{ground_beef:986,ham:987,sausage:988,pepperoni:989,black_olives:990,jalapenos:991,green_peppers:992,mushrooms:993,onions:994,chicken:995,pineapple:996,sweet_peppers:997,banana_peppers:998,broccoli:999,spinach:1000,bacon:1001,extra_cheese:1002,tomatoes:1003,shrimp:1007,anchovy:1008},
      18:{ground_beef:1009,ham:1010,sausage:1011,pepperoni:1012,black_olives:1013,jalapenos:1014,green_peppers:1015,mushrooms:1016,onions:1017,chicken:1018,pineapple:1019,sweet_peppers:1020,banana_peppers:1021,broccoli:1022,spinach:1023,bacon:1024,extra_cheese:1025,tomatoes:1026,shrimp:1030,anchovy:1031}
    };

    // ── MODIFIER IDS ──
    MENU.sub_fixins = {everything:463,lettuce:464,tomatoes:465,mayo:466,mustard:467,ketchup:468,onions:469,hot_peppers:470,raw_onions:746,grilled_onions:747,fried_onions:695,everything_no_hots:1302,pickles:1304,salt_n_pepper:1305,extra_meat:471,bacon:472,extra_cheese:473,shrimp:748,ham:744,turkey:745,banana_peppers:1306,green_peppers:1307,black_olives:1308,mushrooms:1309,oil_and_vinegar:1310,tartar_sauce:1311};
    MENU.cheese_options = {american:488,provolone:489,mozzarella:492,feta:493,no_cheese:491,extra_cheese:490};
    MENU.wing_flavors = {hot:386,mild:387,bbq:368,honey_bbq:369,honey_mustard:370,lemon_pepper:371,garlic_parmesan:372,old_bay:373,honey_old_bay:374,honey_lemon_pepper:375,general_tsos:376,mango_habanero:377,caribbean_jerk:378,thai_chili:379,buffalo:380,extra_hot:381,jamaican_jerk:382,maryland_style:383,southern_style:384,toxic_waste:385,spicy_bbq:389,spicy_honey_bbq:390,roasted_garlic:391,bourbon:392,honey_garlic:393,no_flavor:394};
    MENU.wing_dressings = {ranch:397,blue_cheese:398,hot_sauce:696,extra_dressing:399};
    MENU.soda_flavors = {coke:535,pepsi:536,sprite:537,diet_coke:538,diet_pepsi:539,cherry_coke:540,cherry_pepsi:541,coke_zero:542,mountain_dew:543,dr_pepper:544,root_beer:545,ginger_ale:552,sierra_mist:547,fanta_orange:548,fanta_grape:549,fanta_strawberry:550,fruit_punch:554,half_and_half:555};
    MENU.salad_dressings = {creamy_italian:362,thousand_island:363,caesar:364,balsamic_vinaigrette:365,ranch:397,blue_cheese:398,french:366,honey_mustard:370};
    MENU.tender_sauces = {honey_mustard:615,blue_cheese:616,honey_bbq:617,ranch:618};

    // ── DEALS ──
    MENU.deals = {
      "double deal":{sizes:{12:{id:786,price:19.99},14:{id:787,price:21.99},16:{id:788,price:24.99},18:{id:788,price:24.99}},pizzas:2,freeToppings:1},
      "3 pizza special":{sizes:{14:{id:777,price:36.99},16:{id:778,price:38.99}},pizzas:3,freeToppings:1,includes_2l:true},
      "pizza and wings":{sizes:{12:{id:781,price:25.99},14:{id:782,price:26.99},16:{id:783,price:27.99}},pizzas:1,freeToppings:1,includes_2l:true,wings:10},
      "pizza and sub":{sizes:{12:{id:784,price:22.99},14:{id:794,price:24.99},16:{id:744,price:26.99}},pizzas:1,freeToppings:1,includes_fries:true,includes_can:true},
      "combo deal":{sizes:{12:{id:769,price:29.99},14:{id:770,price:33.99}},pizzas:1,freeToppings:1},
      "sub combo":{sizes:{8:{id:772,price:11.99},12:{id:774,price:15.99}},includes_fries:true,includes_can:true},
      "2 sub combo":{sizes:{0:{id:773,price:21.99}}},
      "3 sub combo":{sizes:{0:{id:780,price:31.99}}},
      "wings and sub":{sizes:{0:{id:771,price:17.99}},wings:6},
      "wings special buffalo":{sizes:{0:{id:840,price:9.49}},includes_fries:true,includes_can:true,wings:6},
      "wings special whole":{sizes:{0:{id:839,price:10.49}},includes_fries:true,includes_can:true,wings:4},
      "chicken box whole":{sizes:{0:{id:838,price:20.99}}},
      "chicken box buffalo":{sizes:{0:{id:847,price:25.99}}},
      "burger combo":{sizes:{0:{id:793,price:7.99}},includes_fries:true,includes_can:true},
      "fish combo":{sizes:{0:{id:831,price:8.99}},includes_fries:true,includes_can:true},
      "party deal":{sizes:{0:{id:776,price:84.99}},pizzas:4,freeToppings:1}
    };

    MENU.loaded = true;
    console.log("Menu loaded: " + MENU.subs.length + " subs, " + MENU.sandwiches.length + " sandwiches, " + Object.keys(MENU.deals).length + " deals");
    return true;
  } catch (e) {
    console.error("Menu load error:", e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// PRICING ENGINE — deterministic, database-driven
// ═══════════════════════════════════════════════════════════════
var FREE_TOPPINGS = ["welldone","lite_sauce","extra_sauce","lite_cheese","no_sauce"];

function round2(n) { return Math.round(n * 100) / 100; }

function norm(s) { return (s||"").toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,""); }

function matchKeyword(input, list) {
  var nm = (input || "").toLowerCase().trim();
  var best = null, bestLen = 0;
  for (var i = 0; i < list.length; i++) {
    var keywords = list[i].keywords || [];
    for (var k = 0; k < keywords.length; k++) {
      if (nm.indexOf(keywords[k]) !== -1 && keywords[k].length > bestLen) {
        best = list[i]; bestLen = keywords[k].length;
      }
    }
  }
  return best;
}

function pricePizza(size, toppings, freeToppings) {
  var sz = parseInt(size) || 14;
  var base = MENU.pizzas[0].prices[sz] || 11.99;
  var pid = MENU.pizzas[0].ids[sz] || 737;
  var labels = {10:"Sm",12:"Med",14:"Lrg",16:"XL",18:"XXL"};
  var mods = [];
  var topCharge = 0;
  var chargeCount = 0;
  var freeCount = freeToppings || 0;

  for (var t = 0; t < (toppings||[]).length; t++) {
    var top = toppings[t];
    var tName = (typeof top === "string" ? top : top.name || "").trim();
    var isHalf = !!(top.half);
    var n = norm(tName);
    
    if (FREE_TOPPINGS.indexOf(n) !== -1) {
      var tid = (MENU.topping_ids[sz]||{})[n] || null;
      mods.push({name:tName, modifier_id:tid, group:"Add Toppings", price:0});
      continue;
    }
    
    chargeCount++;
    var isFree = chargeCount <= freeCount;
    var prices = MENU.topping_prices[sz] || MENU.topping_prices[14];
    var price = 0;
    if (!isFree) {
      if (n === "shrimp" || n === "anchovy") price = isHalf ? prices.half : prices[n];
      else price = isHalf ? prices.half : prices.full;
    }
    topCharge += price;
    
    var aliases = {jalapeno:"jalapenos",onion:"onions",mushroom:"mushrooms",olive:"black_olives",green_pepper:"green_peppers",sweet_pepper:"sweet_peppers",banana_pepper:"banana_peppers",tomato:"tomatoes",pepper:"green_peppers"};
    var normalized = aliases[n] || n;
    var tid = (MENU.topping_ids[sz]||{})[normalized] || null;
    mods.push({name:isHalf?tName+" (Half)":tName, modifier_id:tid, group:"Add Toppings", price:price, charge:price});
  }

  return {
    item_name: sz + " inch " + (labels[sz]||"Lrg") + " Cheese Pizza",
    item_id: pid, category: "Pizzas",
    base_price: base, topping_charges: round2(topCharge),
    unit_price: round2(base + topCharge), modifiers: mods
  };
}

function priceSub(subName, size, fixins, cheese, specialInstructions) {
  var match = matchKeyword(subName, MENU.subs);
  if (!match) return {error: "Sub not found: " + subName};
  
  var isWhole = (size||"").toLowerCase().indexOf("whole") !== -1 || (size||"") === "12";
  var price = isWhole ? match.p12 : match.p8;
  var szLabel = isWhole ? "12 inch Whole" : "8 inch Half";
  
  var mods = [];
  for (var f = 0; f < (fixins||[]).length; f++) {
    var fn = norm(fixins[f]);
    var aliases = {mayonnaise:"mayo",tomato:"tomatoes",onion:"onions",hot_pepper:"hot_peppers",hots:"hot_peppers",pickle:"pickles",grilled_onion:"grilled_onions",fried_onion:"fried_onions",tartar:"tartar_sauce",tarter:"tartar_sauce",no_hots:"everything_no_hots"};
    var resolved = aliases[fn] || fn;
    mods.push({name:fixins[f], modifier_id:MENU.sub_fixins[resolved]||null, group:"Sub Fixins", price:0});
  }
  
  if (cheese) {
    var cn = norm(cheese);
    var ca = {mozz:"mozzarella",prov:"provolone",provo:"provolone"};
    var ck = ca[cn] || cn;
    mods.push({name:cheese, modifier_id:MENU.cheese_options[ck]||null, group:"Cheese Options", price:0});
  }

  var result = {
    item_name: szLabel + " " + match.name,
    item_id: match.id, category: "Submarines",
    base_price: price, unit_price: price, modifiers: mods,
    premium: match.premium
  };
  if (specialInstructions) result.special_instructions = specialInstructions;
  return result;
}

function priceWings(type, quantity) {
  var db = type === "whole" ? MENU.whole_wings : MENU.buffalo_wings;
  var qty = parseInt(quantity) || 0;
  var match = db.find(function(w) { return w.qty === qty; });
  if (!match) return {error: (type==="whole"?"Whole":"Buffalo") + " wings not available in " + qty + " pieces. Available: " + db.map(function(w){return w.qty;}).join(", ")};
  return {
    item_name: qty + " piece " + (type==="whole"?"Whole":"Buffalo") + " Wings",
    item_id: match.id, category: "Wings",
    base_price: match.price, unit_price: match.price, modifiers: []
  };
}

function priceGenericItem(itemName) {
  var allLists = [
    {list: MENU.sandwiches, cat: "Sandwiches"},
    {list: MENU.wraps, cat: "Wraps"},
    {list: MENU.clubs, cat: "Sandwiches"},
    {list: MENU.salads, cat: "Salads"},
    {list: MENU.gyros, cat: "Gyro"},
    {list: MENU.pasta, cat: "Pasta"},
    {list: MENU.stromboli, cat: "Stromboli"},
    {list: MENU.quesadillas, cat: "Quesadillas"},
    {list: MENU.seafood, cat: "Seafood"},
    {list: MENU.platters, cat: "Seafood"},
    {list: MENU.sides, cat: "Sides"},
    {list: MENU.desserts, cat: "Desserts"},
    {list: MENU.beverages, cat: "Beverages"}
  ];
  
  for (var i = 0; i < allLists.length; i++) {
    var match = matchKeyword(itemName, allLists[i].list);
    if (match) {
      return {
        item_name: match.name, item_id: match.id,
        category: allLists[i].cat, unit_price: match.price, modifiers: []
      };
    }
  }
  return {error: "Item not found: " + itemName};
}

// ═══════════════════════════════════════════════════════════════
// DEAL ENGINE — deterministic combo detection
// ═══════════════════════════════════════════════════════════════
function checkDeals(basket, declinedDeals) {
  var pz = [], subs = [], bw = 0, ww = 0, fries = 0, cans = 0, twoL = 0, burger = 0, fish = 0;
  var PREM_IDS = [723, 724, 725, 726, 710];
  
  for (var i = 0; i < basket.length; i++) {
    var it = basket[i];
    if (it.is_combo) continue;
    var nm = (it.item_name || "").toLowerCase();
    var id = parseInt(it.item_id) || 0;
    var cat = (it.category || "").toLowerCase();
    
    if (cat === "pizzas" && nm.indexOf("cheese pizza") !== -1) {
      var m = nm.match(/(\d+)\s*inch/);
      pz.push(m ? parseInt(m[1]) : 14);
    }
    if (cat === "submarines") subs.push({sz: nm.indexOf("12 inch") !== -1 ? 12 : 8, id: id, prem: PREM_IDS.indexOf(id) !== -1});
    if (nm.indexOf("buffalo") !== -1 && cat === "wings") bw += parseInt(nm) || 0;
    if (nm.indexOf("whole") !== -1 && cat === "wings") ww += parseInt(nm) || 0;
    if (nm.indexOf("fries") !== -1 || cat === "sides") fries++;
    if (nm.indexOf("can soda") !== -1) cans++;
    if (nm.indexOf("2 liter") !== -1) twoL++;
    if (nm.indexOf("burger sandwich") !== -1 || nm.indexOf("cheeseburger") !== -1) burger++;
    if (nm.indexOf("fish sandwich") !== -1) fish++;
  }
  
  var reg = subs.filter(function(s) { return !s.prem; });
  var declined = declinedDeals || [];
  function no(d) { return declined.indexOf(d) !== -1; }
  
  // Exact matches
  if (pz.length>=4&&bw>=48&&fries&&twoL&&!no("party")) return {match:"party_deal",type:"exact"};
  if (pz.length>=3&&pz[0]===pz[1]&&pz[1]===pz[2]&&[14,16].indexOf(pz[0])!==-1&&twoL&&!no("3pz")) return {match:"3_pizza",type:"exact"};
  if (pz.length>=2&&pz[0]===pz[1]&&[12,14,16,18].indexOf(pz[0])!==-1&&!no("dd")) return {match:"double_deal",type:"exact"};
  if (pz.length>=1&&reg.length>=1&&bw>0&&cans>=2&&!no("combo")) return {match:"combo_deal",type:"exact"};
  if (pz.length>=1&&bw>0&&twoL>0&&!no("pw")) return {match:"pizza_wings",type:"exact"};
  if (pz.length>=1&&reg.length>=1&&fries>0&&cans>0&&!no("ps")) return {match:"pizza_sub",type:"exact"};
  if (reg.length>=1&&bw>=6&&cans>0&&!no("ws")) return {match:"wings_sub",type:"exact"};
  if (subs.length>=3&&fries>=3&&cans>=3&&!no("3sc")) return {match:"3_sub_combo",type:"exact"};
  if (subs.length>=2&&fries>=2&&cans>=2&&!no("2sc")) return {match:"2_sub_combo",type:"exact"};
  if (subs.length>=1&&fries>0&&cans>0&&!no("sc")) return {match:"sub_combo",type:"exact"};
  if (bw>=12&&cans>=2&&!no("cbb")) return {match:"chicken_box_buffalo",type:"exact"};
  if (ww>=8&&cans>=2&&!no("cbw")) return {match:"chicken_box_whole",type:"exact"};
  if (bw===6&&fries&&cans&&!no("wsb")) return {match:"wings_special_buffalo",type:"exact"};
  if (ww===4&&fries&&cans&&!no("wsw")) return {match:"wings_special_whole",type:"exact"};
  if (burger&&fries&&cans&&!no("bc")) return {match:"burger_combo",type:"exact"};
  if (fish&&fries&&cans&&!no("fc")) return {match:"fish_combo",type:"exact"};

  // Near matches
  if (pz.length>=2&&pz[0]===pz[1]&&!no("dd")) return {match:"near_dd",type:"near",suggestion:"I can make those a double deal. Want that?"};
  if (pz.length>=1&&bw>0&&!twoL&&!no("pw")) return {match:"near_pw",type:"near",suggestion:"Want a two-liter for the family deal?"};
  if (pz.length>=1&&reg.length>=1&&(!fries||!cans)&&!no("ps")) return {match:"near_ps",type:"near",suggestion:"Want fries and a soda for the pizza sub combo?"};
  if (pz.length>=1&&reg.length>=1&&bw>0&&cans<2&&!no("combo")) return {match:"near_combo",type:"near",suggestion:"Add two cans for the combo deal?"};
  if (subs.length===1&&(!fries||!cans)&&!no("sc")) return {match:"near_sc",type:"near",suggestion:"Want a combo with fries and a soda?"};
  if (bw===6&&(!fries||!cans)&&!no("wsb")) return {match:"near_wbuf",type:"near",suggestion:"Want fries and a soda for the wings special?"};
  if (ww===4&&(!fries||!cans)&&!no("wsw")) return {match:"near_wwhole",type:"near",suggestion:"Want fries and a soda for the wings special?"};
  if (burger&&(!fries||!cans)&&!no("bc")) return {match:"near_bc",type:"near",suggestion:"Want fries and a soda for the burger combo?"};
  if (fish&&(!fries||!cans)&&!no("fc")) return {match:"near_fc",type:"near",suggestion:"Want fries and a soda for the fish combo?"};

  return {match: "none", type: "none"};
}

// ═══════════════════════════════════════════════════════════════
// STATE MACHINE — deterministic transitions
// ═══════════════════════════════════════════════════════════════
// States: greeting, collecting, asking_field, suggesting_deal, 
//         confirming, payment, collecting_card, submitting, done

function processUtterance(session, input) {
  var intent = (input.intent || "").toLowerCase();
  var items = input.items || [];
  var answer = input.answer || "";
  var utterance = input.utterance || "";
  var state = session.state;
  var response = { say: "", action: "continue" };

  // ── GREETING ──
  if (state === "greeting") {
    if (intent === "delivery" || utterance.toLowerCase().indexOf("delivery") !== -1) {
      session.order_type = "delivery";
      session.state = "collecting_address";
      response.say = "What's the street address and zip code?";
      return response;
    }
    if (intent === "pickup" || utterance.toLowerCase().indexOf("pickup") !== -1 || utterance.toLowerCase().indexOf("pick up") !== -1) {
      session.order_type = "pickup";
    }
    // If they ordered items at greeting, process them
    if (items.length > 0) {
      session.order_type = session.order_type || "pickup";
      session.state = "collecting";
      return processItems(session, items, response);
    }
    session.state = "collecting";
    response.say = "What can I get for you?";
    return response;
  }

  // ── COLLECTING ADDRESS ──
  if (state === "collecting_address") {
    if (input.delivery_address && input.delivery_zip) {
      session.delivery_address = input.delivery_address;
      session.delivery_zip = input.delivery_zip;
      session.state = "collecting";
      response.say = "Got it. What can I get for you?";
      // TODO: verify address via tool in production
      return response;
    }
    if (intent === "pickup") {
      session.order_type = "pickup";
      session.state = "collecting";
      response.say = "Got it, pickup. What can I get for you?";
      return response;
    }
    response.say = "I need the street address and zip code for delivery.";
    return response;
  }

  // ── COLLECTING ITEMS ──
  if (state === "collecting" || state === "asking_field") {
    // Handle answer to a pending question
    if (state === "asking_field" && session.current_item && session.missing_fields.length > 0) {
      var field = session.missing_fields[0];
      if (answer || utterance) {
        var val = answer || utterance.trim();
        session.current_item[field] = val;
        session.missing_fields.shift();
        
        // More fields needed?
        if (session.missing_fields.length > 0) {
          response.say = getFieldQuestion(session.missing_fields[0], session.current_item);
          return response;
        }
        
        // All fields collected — price it
        var priced = priceItem(session.current_item);
        if (priced.error) {
          response.say = priced.error;
          session.state = "collecting";
          session.current_item = null;
          return response;
        }
        session.basket.push(priced);
        session.current_item = null;
        session.state = "collecting";
        
        // Check deals
        var deal = checkDeals(session.basket, session.declined_deals);
        if (deal.type === "near" && session.suggested_deals.indexOf(deal.match) === -1) {
          session.suggested_deals.push(deal.match);
          session.pending_deal = deal;
          session.state = "suggesting_deal";
          response.say = "Got it. " + deal.suggestion;
          return response;
        }
        if (deal.type === "exact") {
          session.pending_deal = deal;
          session.state = "suggesting_deal";
          response.say = "Got it. I can make that a " + deal.match.replace(/_/g, " ") + ". Want that?";
          return response;
        }
        
        response.say = "Got it. Anything else?";
        return response;
      }
    }

    // Customer says done
    if (intent === "done_ordering" || intent === "confirm" || 
        utterance.toLowerCase().match(/\b(that'?s it|that'?s all|nothing else|no|nope|i'?m done|place.*(order|it))\b/)) {
      // Process any pending items first
      if (items.length > 0) {
        var r = processItems(session, items, response);
        // After processing, go to confirm
        session.state = "confirming";
        return r;
      }
      if (session.basket.length === 0) {
        response.say = "You haven't ordered anything yet. What can I get for you?";
        return response;
      }
      session.state = "confirming";
      return buildConfirmation(session, response);
    }

    // Customer asks about specials
    if (intent === "ask_specials") {
      response.say = "We have the double deal, family deal with pizza and wings, sub combo, wings special, and more. What can I get for you?";
      return response;
    }

    // New items to process
    if (items.length > 0) {
      return processItems(session, items, response);
    }

    // Deal by name
    if (intent === "order_deal" && input.deal_name) {
      response.say = "Let me set up the " + input.deal_name + ". What size pizza?";
      session.state = "collecting_deal";
      session.current_deal = input.deal_name.toLowerCase();
      return response;
    }

    response.say = "What can I get for you?";
    return response;
  }

  // ── SUGGESTING DEAL ──
  if (state === "suggesting_deal") {
    if (intent === "confirm" || utterance.toLowerCase().match(/\b(yes|yeah|sure|ok|yep)\b/)) {
      // Customer accepted deal — need to collect remaining deal fields
      // For now, route to deal collection
      session.state = "collecting_deal";
      session.current_deal = session.pending_deal.match;
      response.say = "What flavor soda?";
      return response;
    }
    if (intent === "deny" || utterance.toLowerCase().match(/\b(no|nah|nope)\b/)) {
      if (session.pending_deal) {
        session.declined_deals.push(session.pending_deal.match);
      }
      session.pending_deal = null;
      session.state = "collecting";
      
      // Check if they also mentioned new items
      if (items.length > 0) {
        return processItems(session, items, response);
      }
      response.say = "No problem. Anything else?";
      return response;
    }
    // They might be ordering more instead
    if (items.length > 0) {
      session.pending_deal = null;
      session.state = "collecting";
      return processItems(session, items, response);
    }
    response.say = "Would you like to add that deal?";
    return response;
  }

  // ── CONFIRMING ORDER ──
  if (state === "confirming") {
    if (intent === "confirm" || utterance.toLowerCase().match(/\b(yes|yeah|ok|sounds good|correct|yep|place it)\b/)) {
      session.state = "payment";
      if (session.order_type === "pickup") {
        response.say = "You'll pay at the counter when you pick up.";
        session.payment_method = "cash";
        session.state = "submitting";
        return response;
      }
      response.say = "Will that be cash or card?";
      return response;
    }
    if (intent === "deny" || intent === "modify") {
      session.state = "collecting";
      response.say = "What would you like to change?";
      return response;
    }
    if (items.length > 0) {
      session.state = "collecting";
      return processItems(session, items, response);
    }
    return buildConfirmation(session, response);
  }

  // ── PAYMENT ──
  if (state === "payment") {
    if (intent === "pay_cash" || utterance.toLowerCase().indexOf("cash") !== -1) {
      session.payment_method = "cash";
      session.state = "submitting";
      response.say = "Got it, cash.";
      return response;
    }
    if (intent === "pay_card" || utterance.toLowerCase().indexOf("card") !== -1) {
      session.state = "collecting_card";
      response.say = "What's the card number?";
      return response;
    }
    response.say = "Will that be cash or card?";
    return response;
  }

  // ── SUBMITTING ──
  if (state === "submitting") {
    if (!session.customer_name && input.customer_name) {
      session.customer_name = input.customer_name;
    }
    if (!session.customer_phone && input.customer_phone) {
      session.customer_phone = input.customer_phone;
    }
    
    if (!session.customer_phone) {
      response.say = "What's a good phone number for the order?";
      response.need = "phone";
      return response;
    }
    if (!session.customer_name) {
      response.say = "And what name for the order?";
      response.need = "name";
      return response;
    }
    
    // Ready to submit
    response.action = "submit";
    response.order = buildOrderPayload(session);
    response.say = "Placing the order now.";
    return response;
  }

  // Fallback
  response.say = "I'm sorry, could you repeat that?";
  return response;
}

// ── Process multiple items from one utterance ──
function processItems(session, items, response) {
  var messages = [];
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var missing = getMissingFields(item);
    
    if (missing.length > 0) {
      // Store as current item, ask for first missing field
      session.current_item = item;
      session.missing_fields = missing;
      session.state = "asking_field";
      
      if (messages.length > 0) {
        response.say = messages.join(" ") + " " + getFieldQuestion(missing[0], item);
      } else {
        response.say = getFieldQuestion(missing[0], item);
      }
      
      // Queue remaining items
      if (i + 1 < items.length) {
        session.pending_items = items.slice(i + 1);
      }
      return response;
    }
    
    // All fields present — price it
    var priced = priceItem(item);
    if (priced.error) {
      messages.push(priced.error);
      continue;
    }
    session.basket.push(priced);
    messages.push("Got it.");
  }
  
  // All items processed — check deals
  var deal = checkDeals(session.basket, session.declined_deals);
  if (deal.type === "near" && session.suggested_deals.indexOf(deal.match) === -1) {
    session.suggested_deals.push(deal.match);
    session.pending_deal = deal;
    session.state = "suggesting_deal";
    response.say = (messages.length > 0 ? messages.join(" ") + " " : "") + deal.suggestion;
    return response;
  }
  if (deal.type === "exact") {
    session.pending_deal = deal;
    session.state = "suggesting_deal";
    response.say = (messages.length > 0 ? messages.join(" ") + " " : "") + "I can make that a " + deal.match.replace(/_/g, " ") + ". Want that?";
    return response;
  }
  
  response.say = (messages.length > 0 ? messages.join(" ") + " " : "") + "Anything else?";
  return response;
}

// ── Determine missing required fields ──
function getMissingFields(item) {
  var type = (item.item_type || "").toLowerCase();
  var missing = [];
  
  if (type === "pizza") {
    if (!item.size) missing.push("size");
    // toppings are optional (can be just cheese)
  }
  else if (type === "sub") {
    if (!item.name && !item.sub_name) missing.push("name");
    // fixins required
    if (!item.fixins || item.fixins.length === 0) missing.push("fixins");
    if (!item.cheese) missing.push("cheese");
  }
  else if (type === "buffalo_wings") {
    if (!item.quantity) missing.push("quantity");
    if (!item.flavor) missing.push("flavor");
    if (!item.dressing) missing.push("dressing");
  }
  else if (type === "whole_wings") {
    if (!item.quantity) missing.push("quantity");
  }
  else if (type === "salad") {
    if (!item.dressing) missing.push("dressing");
  }
  else if (type === "gyro") {
    if (!item.name) missing.push("meat_type");
  }
  else if (type === "drink" && (!item.soda_flavor && (item.name||"").toLowerCase().indexOf("soda") !== -1)) {
    missing.push("soda_flavor");
  }
  
  return missing;
}

// ── Generate question for a missing field ──
function getFieldQuestion(field, item) {
  var type = (item.item_type || "").toLowerCase();
  switch (field) {
    case "size": return "What size — small, medium, large, or x-large?";
    case "name": return type === "sub" ? "Which sub would you like?" : "Which one?";
    case "fixins": return "What do you want on it?";
    case "cheese": return "What cheese — American, provolone, or mozzarella?";
    case "flavor": return "What flavor?";
    case "dressing": return type === "salad" ? "What dressing?" : "Ranch or blue cheese?";
    case "quantity": return "How many pieces?";
    case "meat_type": return "Chicken or lamb?";
    case "soda_flavor": return "What flavor soda?";
    default: return "What would you like for " + field + "?";
  }
}

// ── Price any item based on type ──
function priceItem(item) {
  var type = (item.item_type || "").toLowerCase();
  
  if (type === "pizza") {
    return pricePizza(item.size, item.toppings, 0);
  }
  if (type === "sub") {
    return priceSub(item.name || item.sub_name, item.size || "half", item.fixins, item.cheese, item.special_instructions);
  }
  if (type === "buffalo_wings") {
    var result = priceWings("buffalo", item.quantity);
    if (!result.error) {
      if (item.flavor) {
        var fn = norm(item.flavor);
        result.modifiers.push({name:item.flavor, modifier_id:MENU.wing_flavors[fn]||null, group:"Wings - Flavors", price:0});
      }
      if (item.dressing) {
        var dn = norm(item.dressing);
        result.modifiers.push({name:item.dressing, modifier_id:MENU.wing_dressings[dn]||null, group:"Wings - Dressing", price:0});
      }
    }
    return result;
  }
  if (type === "whole_wings") {
    return priceWings("whole", item.quantity);
  }
  if (type === "sandwich" || type === "wrap" || type === "club") {
    return priceGenericItem(item.name);
  }
  if (type === "salad") {
    var r = priceGenericItem(item.name);
    if (!r.error && item.dressing) {
      var dn = norm(item.dressing);
      r.modifiers = r.modifiers || [];
      r.modifiers.push({name:item.dressing, modifier_id:MENU.salad_dressings[dn]||null, group:"Salad Dressing", price:0});
    }
    return r;
  }
  if (type === "drink") {
    var r = priceGenericItem(item.name || "can soda");
    if (!r.error && item.soda_flavor) {
      var sn = norm(item.soda_flavor);
      r.modifiers = r.modifiers || [];
      r.modifiers.push({name:item.soda_flavor, modifier_id:MENU.soda_flavors[sn]||null, group:"Soda Can", price:0});
    }
    return r;
  }
  
  // Generic fallback
  return priceGenericItem(item.name || "");
}

// ── Build order confirmation text ──
function buildConfirmation(session, response) {
  var subtotal = 0;
  var lines = [];
  
  for (var i = 0; i < session.basket.length; i++) {
    var it = session.basket[i];
    var price = parseFloat(it.unit_price) || 0;
    subtotal += price;
    lines.push(it.item_name + " for " + formatPrice(price));
  }
  
  subtotal = round2(subtotal);
  var tax = round2(subtotal * 0.06);
  var fee = session.order_type === "delivery" ? 2.00 : 0;
  var total = round2(subtotal + tax + fee);
  
  session.subtotal = subtotal;
  session.tax = tax;
  session.delivery_fee = fee;
  session.total = total;
  
  var say = "Let me read that back. " + lines.join(", ") + ". ";
  say += "Subtotal is " + formatPrice(subtotal) + ", tax is " + formatPrice(tax);
  if (fee > 0) say += ", delivery fee is " + formatPrice(fee);
  say += ", total is " + formatPrice(total) + ". Does that sound good?";
  
  response.say = say;
  return response;
}

function formatPrice(n) {
  var d = n.toFixed(2).split(".");
  var dollars = parseInt(d[0]);
  var cents = parseInt(d[1]);
  if (cents === 0) return dollars + " dollars";
  return dollars + " " + cents;
}

// ── Build POS order payload ──
function buildOrderPayload(session) {
  return {
    order_type: session.order_type,
    customer_name: session.customer_name,
    customer_phone: session.customer_phone,
    delivery_address: session.order_type === "delivery" ? session.delivery_address : undefined,
    payment_method: session.payment_method,
    payment_ref: session.payment_ref || undefined,
    items: session.basket.map(function(it) {
      return {
        item_name: it.item_name,
        item_id: String(it.item_id),
        unit_price: it.unit_price,
        quantity: it.quantity || 1,
        is_combo: !!it.is_combo,
        modifiers: it.modifiers || [],
        components: it.components || [],
        special_instructions: it.special_instructions || undefined
      };
    }),
    subtotal: session.subtotal,
    tax: session.tax,
    delivery_fee: session.delivery_fee,
    total: session.total
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENDPOINT — called by Retell after every utterance
// ═══════════════════════════════════════════════════════════════
app.post("/retell/function/process_utterance", function (req, res) {
  var data = req.body.args || req.body;
  var callObj = req.body.call || {};
  var callId = callObj.call_id || data.session_id || "unknown_" + Date.now();
  
  var session = getSession(callId);
  
  console.log("\n=== UTTERANCE [" + session.state + "] ===");
  console.log("  Intent:", data.intent);
  console.log("  Utterance:", (data.utterance || "").substring(0, 100));
  console.log("  Items:", (data.items || []).length);
  console.log("  Basket:", session.basket.length, "items");
  
  var result = processUtterance(session, data);
  
  console.log("  → State:", session.state);
  console.log("  → Say:", (result.say || "").substring(0, 100));
  console.log("  → Basket:", session.basket.length, "items, $" + session.basket.reduce(function(s,i){return s+(i.unit_price||0);},0).toFixed(2));
  
  if (result.action === "submit" && result.order) {
    // Auto-submit to POS
    var built = buildXml(result.order);
    console.log("  → Submitting to POS, ref:", built.ref);
    sendToPOS(built.xml).then(function(posResult) {
      console.log("  → POS result:", posResult.ok ? "OK" : "FAIL");
    }).catch(function(e) {
      console.error("  → POS error:", e.message);
    });
    
    res.json({
      say: "Your order is placed, reference number " + built.ref + ". " + (session.order_type === "pickup" ? "Pickup fifteen to twenty minutes." : "Delivery thirty to forty-five minutes.") + " Thanks for calling!",
      action: "end_call",
      ref: built.ref
    });
    return;
  }
  
  res.json(result);
});


// ═══════════════════════════════════════════════════════════════
// POS INTEGRATION — Full XML builder, payment, address, caller ID
// Merged from server_v18.js — production-tested
// ═══════════════════════════════════════════════════════════════

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
  "american cold cut sub": {8:825,12:825},
  "american cold cut": {8:825,12:825},
  "american hot cut sub": {8:826,12:826},
  "american hot cut": {8:826,12:826},

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
      var regModPrice = parseFloat(mod.price || 0);
      var regModDisplay = mod.name || mod;
      if (regModPrice > 0) regModDisplay += " +$" + regModPrice.toFixed(2);
      o += "<Requirement>";
      if (mod.group) o += "<groupMame>" + X(mod.group) + "</groupMame>";
      o += NT + X(regModDisplay) + NTC;
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

  // Line 1: Combo deal name with full price — no details, just the deal
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
  o += "</OrderLineItem>";

  // Lines 2+: Each component as its own OrderLineItem at $0 with details
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
          var mod2Price = parseFloat(mod2.price || 0);
          var mod2Display = mod2.name || "";
          if (mod2Price > 0) mod2Display += " +$" + mod2Price.toFixed(2);
          o += "<Requirement>";
          if (mod2.group) o += "<groupMame>" + X(mod2.group) + "</groupMame>";
          o += NT + X(mod2Display) + NTC;
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

    // ═══ SERVER-SIDE VALIDATION — reject fabricated data ═══
    var VALID_DEAL_IDS = {769:1,770:1,771:1,772:1,773:1,774:1,775:1,776:1,777:1,778:1,780:1,781:1,782:1,783:1,784:1,786:1,787:1,788:1,793:1,794:1,831:1,838:1,839:1,840:1,744:1,847:1};
    var validationErrors = [];

    if (data.items && data.items.length > 0) {
      for (var v = 0; v < data.items.length; v++) {
        var vi = data.items[v];
        var vid = String(vi.item_id || "");
        var vname = (vi.item_name || "").toLowerCase();
        var vprice = parseFloat(vi.unit_price || 0);

        // 1. Reject made-up item IDs (non-numeric or clearly fake like 1001, 1002, 1003)
        if (vid && !/^\d+$/.test(vid)) {
          validationErrors.push("Item '" + vi.item_name + "' has non-numeric ID: " + vid);
        }
        if (parseInt(vid) >= 1000 && parseInt(vid) <= 1099 && !VALID_DEAL_IDS[parseInt(vid)]) {
          validationErrors.push("Item '" + vi.item_name + "' has fabricated ID: " + vid + ". Use calculate_price or calculate_combo to get the correct ID.");
        }

        // 2. Combo items MUST have been through calculate_combo (valid deal_id)
        if (vi.is_combo) {
          if (!vid || !VALID_DEAL_IDS[parseInt(vid)]) {
            // Try to fix from DEAL_IDS map
            var dealFix = null;
            for (var dk in DEAL_IDS) {
              if (vname.indexOf(dk) !== -1) { dealFix = DEAL_IDS[dk]; break; }
            }
            if (dealFix) {
              // Try to find the right size-specific ID
              var sizeMatch = vname.match(/(\d+)\s*inch/);
              var dealSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;
              if (typeof dealFix === "object" && dealFix[dealSize]) {
                vi.item_id = String(dealFix[dealSize]);
                console.log("VALIDATE-FIX: " + vname + " ID " + vid + " → " + vi.item_id);
              } else if (typeof dealFix === "object" && dealFix[0]) {
                vi.item_id = String(dealFix[0]);
                console.log("VALIDATE-FIX: " + vname + " ID " + vid + " → " + vi.item_id);
              } else if (typeof dealFix === "number") {
                vi.item_id = String(dealFix);
                console.log("VALIDATE-FIX: " + vname + " ID " + vid + " → " + vi.item_id);
              } else {
                validationErrors.push("Combo '" + vi.item_name + "' has invalid deal ID: " + vid + ". Call calculate_combo first.");
              }
            } else {
              validationErrors.push("Combo '" + vi.item_name + "' has invalid deal ID: " + vid + ". Call calculate_combo first.");
            }
          }

          // 3. Combo price validation — check against known deal prices
          var comboDB = COMBO_DB || {};
          for (var cdk in comboDB) {
            if (vname.indexOf(cdk) !== -1 || (comboDB[cdk].desc && vname.indexOf(cdk.replace(/ /g,"")) !== -1)) {
              var cdeal = comboDB[cdk];
              if (cdeal.sizes) {
                var sizeMatch2 = vname.match(/(\d+)\s*inch/);
                var ds = sizeMatch2 ? parseInt(sizeMatch2[1]) : 0;
                var dse = cdeal.sizes[ds] || cdeal.sizes[0];
                if (dse && vprice < dse.price) {
                  validationErrors.push("Combo '" + vi.item_name + "' price " + vprice + " is below base price " + dse.price + ". Call calculate_combo for correct pricing.");
                }
              }
              break;
            }
          }
        }

        // 4. Regular item price validation — $0 items are suspicious
        if (!vi.is_combo && vprice <= 0 && vname.indexOf("fries") === -1 && vname.indexOf("soda") === -1) {
          validationErrors.push("Item '" + vi.item_name + "' has $0 price. Call calculate_price first.");
        }

        // 5. Check for missing customer name
        if (!data.customer_name || data.customer_name === "?" || data.customer_name.toLowerCase() === "customer") {
          if (validationErrors.indexOf("Missing customer name. Ask the caller for their name.") === -1) {
            validationErrors.push("Missing customer name. Ask the caller for their name.");
          }
        }
      }
    }

    // Return errors to agent — force it to use tools
    if (validationErrors.length > 0) {
      console.log("VALIDATION FAILED:", validationErrors);
      log.status = "VALIDATION_FAILED";
      log.validation_errors = validationErrors;
      orderLog.unshift(log); if (orderLog.length > 50) orderLog.pop();
      return res.json("ERROR: Order rejected. " + validationErrors.join(" | ") + " Fix these issues and try again.");
    }
    // ═══ END VALIDATION ═══

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
  receipt += "Subtotal: $" + parseFloat(found.total || 0).toFixed(2) + "\n";
  receipt += "═══════════════════════════════════════\n";
  res.type("text/plain").send(receipt);
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════

app.get("/reload-menu", async function (req, res) {
  var ok = await loadMenu();
  res.json({ success: ok, deals: Object.keys(MENU.deals).length, subs: MENU.subs.length });
});

app.get("/health", function (req, res) {
  res.json({
    status: "ok",
    menu_loaded: MENU.loaded,
    active_sessions: Object.keys(SESSIONS).length,
    version: "2.0"
  });
});

app.get("/sessions", function (req, res) {
  var sessions = Object.values(SESSIONS).map(function (s) {
    return { id: s.id, state: s.state, basket: s.basket.length, total: s.total, age: Math.round((Date.now() - s.created) / 1000) + "s" };
  });
  res.json(sessions);
});

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
var PORT = process.env.PORT || 3000;
loadMenu().then(function () {
  app.listen(PORT, function () {
    console.log("Demo Pizza Orchestrator v2.0 running on port " + PORT);
  });
});
