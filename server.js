const express = require("express");
const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════════
// CONFIGURATION — EDIT THESE FOR EACH RESTAURANT
// ═══════════════════════════════════════════════════
const CONFIG = {
  RESTAURANT_ID: process.env.RESTAURANT_ID || "80001",
  PASSWORD: process.env.PASSWORD || "ABC888",
  SUPERMENU_URL: "https://www.mealage.us/aivoice/orders.jsp",
  TAX_RATE: 0.06,
  DELIVERY_FEE: 1.95,
  PORT: process.env.PORT || 3000,
};

// ═══════════════════════════════════════════════════
// HELPER: Generate unique order reference number
// ═══════════════════════════════════════════════════
function generateReferenceNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

// ═══════════════════════════════════════════════════
// HELPER: Get current timestamp in Supermenu format
// ═══════════════════════════════════════════════════
function getTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// ═══════════════════════════════════════════════════
// HELPER: Escape XML special characters
// ═══════════════════════════════════════════════════
function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ═══════════════════════════════════════════════════
// HELPER: Build XML for one order line item
// ═══════════════════════════════════════════════════
function buildOrderLineItem(item) {
  let xml = `    <OrderLineItem>\n`;
  xml += `      <itemName>${escapeXml(item.item_name || item.name || "Item")}</itemName>\n`;

  if (item.additional_requirements || item.special_instructions) {
    xml += `      <additionalRequirements>${escapeXml(item.additional_requirements || item.special_instructions)}</additionalRequirements>\n`;
  }

  if (item.item_id || item.food_menu_item_id) {
    xml += `      <foodMenuItemId>${escapeXml(item.item_id || item.food_menu_item_id)}</foodMenuItemId>\n`;
  }

  xml += `      <quantity>${item.quantity || 1}</quantity>\n`;
  xml += `      <unitPrice>${parseFloat(item.unit_price || item.price || 0).toFixed(2)}</unitPrice>\n`;
  xml += `      <printKitchen>Y</printKitchen>\n`;

  // Add modifiers/requirements
  if (item.modifiers && item.modifiers.length > 0) {
    xml += `      <Requirements>\n`;
    for (const mod of item.modifiers) {
      xml += `        <Requirement>\n`;
      if (mod.group) {
        xml += `          <groupMame>${escapeXml(mod.group)}</groupMame>\n`;
      }
      xml += `          <name>${escapeXml(mod.name || mod)}</name>\n`;
      xml += `          <quantity>1</quantity>\n`;
      xml += `          <price>${parseFloat(mod.price || 0).toFixed(2)}</price>\n`;
      xml += `        </Requirement>\n`;
    }
    xml += `      </Requirements>\n`;
  }

  xml += `    </OrderLineItem>\n`;
  return xml;
}

// ═══════════════════════════════════════════════════
// HELPER: Build complete Supermenu XML order
// ═══════════════════════════════════════════════════
function buildOrderXml(orderData) {
  const refNumber = generateReferenceNumber();
  const timeString = getTimeString();

  // Calculate totals
  const subtotal = parseFloat(orderData.subtotal || 0);
  const tax = parseFloat(orderData.tax || (subtotal * CONFIG.TAX_RATE));
  const deliveryCharge =
    orderData.order_type === "delivery" ? CONFIG.DELIVERY_FEE : 0;
  const total = parseFloat(
    orderData.total || (subtotal + tax + deliveryCharge)
  );

  // Determine order type for Supermenu
  const orderType =
    orderData.order_type === "delivery" ? "Delivery" : "Pick-Up";

  // Parse customer name
  const fullName = orderData.customer_name || "Guest";
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Guest";
  const lastName = nameParts.slice(1).join(" ") || "Order";

  // Parse phone
  const phone = orderData.customer_phone || "0000000000";
  const phoneClean = phone.replace(/\D/g, "");
  const phoneAreaCode = phoneClean.substring(0, 3) || "000";
  const phoneNumber = phoneClean.substring(3) || "0000000";

  let xml = `<FoodOrder>\n`;
  xml += `  <referenceNumber>${refNumber}</referenceNumber>\n`;
  xml += `  <timeString>${timeString}</timeString>\n`;
  xml += `  <type>${orderType}</type>\n`;
  xml += `  <comments>${escapeXml(orderData.special_instructions || "")}</comments>\n`;
  xml += `  <payment>CASH</payment>\n`;
  xml += `  <subtotal>${subtotal.toFixed(2)}</subtotal>\n`;
  xml += `  <tax>${tax.toFixed(2)}</tax>\n`;
  xml += `  <total>${total.toFixed(2)}</total>\n`;

  if (deliveryCharge > 0) {
    xml += `  <deliveryCharge>${deliveryCharge.toFixed(2)}</deliveryCharge>\n`;
  }

  // Customer info
  xml += `  <Customer>\n`;
  xml += `    <firstName>${escapeXml(firstName)}</firstName>\n`;
  xml += `    <lastName>${escapeXml(lastName)}</lastName>\n`;
  xml += `    <phoneAreaCode>${phoneAreaCode}</phoneAreaCode>\n`;
  xml += `    <phone>${phoneNumber}</phone>\n`;
  xml += `    <email>order@phone.ai</email>\n`;
  xml += `  </Customer>\n`;

  // Address (delivery only)
  if (orderData.order_type === "delivery" && orderData.delivery_address) {
    xml += `  <Address>\n`;
    xml += `    <addressLine1>${escapeXml(orderData.delivery_address)}</addressLine1>\n`;
    xml += `    <city></city>\n`;
    xml += `    <state></state>\n`;
    xml += `    <zip></zip>\n`;
    xml += `  </Address>\n`;
  }

  // Items
  xml += `  <Items>\n`;
  if (orderData.items && orderData.items.length > 0) {
    for (const item of orderData.items) {
      xml += buildOrderLineItem(item);
    }
  }
  xml += `  </Items>\n`;
  xml += `</FoodOrder>`;

  return { xml, refNumber };
}

// ═══════════════════════════════════════════════════
// ROUTE: Submit order to Supermenu POS
// ═══════════════════════════════════════════════════
app.post("/retell/function/submit_order", async (req, res) => {
  try {
    const { args, call } = req.body;

    console.log("=== ORDER RECEIVED FROM RETELL ===");
    console.log("Args:", JSON.stringify(args, null, 2));

    // Build XML
    const { xml, refNumber } = buildOrderXml(args);

    console.log("=== GENERATED XML ===");
    console.log(xml);

    // Send to Supermenu POS
    const url = `${CONFIG.SUPERMENU_URL}?id=${CONFIG.RESTAURANT_ID}&password=${CONFIG.PASSWORD}`;

    const posResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xml,
    });

    const posResult = await posResponse.text();
    console.log("=== POS RESPONSE ===");
    console.log(posResult);

    // Check if successful
    const isSuccess =
      posResult.toLowerCase().includes("success") || posResponse.ok;

    if (isSuccess) {
      res.json({
        status: "success",
        message: `Order placed successfully. Reference number: ${refNumber}`,
        reference_number: refNumber,
        pos_response: posResult,
      });
    } else {
      res.json({
        status: "error",
        message: "Order was received but POS returned an issue. Staff will confirm.",
        reference_number: refNumber,
        pos_response: posResult,
      });
    }
  } catch (error) {
    console.error("Error submitting order:", error);
    res.json({
      status: "error",
      message: "Order noted. Staff will process it shortly.",
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.json({
    status: "running",
    restaurant_id: CONFIG.RESTAURANT_ID,
    endpoints: ["/retell/function/submit_order"],
  });
});

// ═══════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════
app.listen(CONFIG.PORT, () => {
  console.log(`Supermenu POS bridge running on port ${CONFIG.PORT}`);
  console.log(`Restaurant ID: ${CONFIG.RESTAURANT_ID}`);
  console.log(`Endpoint: POST /retell/function/submit_order`);
});
