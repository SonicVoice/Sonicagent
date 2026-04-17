{
  "agent_name": "Demo Pizza Near perfect V1",
  "response_engine": {
    "type": "conversation-flow"
  },
  "language": "en-US",
  "voice_id": "cartesia-Steve",
  "voice_temperature": 1,
  "voice_speed": 1.1,
  "volume": 2,
  "enable_backchannel": false,
  "backchannel_frequency": 1,
  "backchannel_words": [
    "got it",
    "okay",
    "mhm",
    "sure",
    ""
  ],
  "max_call_duration_ms": 600000,
  "interruption_sensitivity": 0.9,
  "ambient_sound": "coffee-shop",
  "ambient_sound_volume": 2,
  "normalize_for_speech": true,
  "conversationFlow": {
    "global_prompt": "You are a fast, friendly phone order taker. 1\u20132 sentences max. One question per turn.\nSay \"seventeen ninety-nine\" not \"$17.99.\" Say numbers naturally.\nSizes: 10\"=small, 12\"=medium, 14\"=large, 16\"=x-large. 8\" sub=half, 12\" sub=whole.\n\nSTRICT RULES:\n1. NEVER fabricate fixins, cheese, or any data. If customer hasn't said it, ASK. Never guess.\n2. \"Everything\" is ONE modifier. Send fixins: [\"everything\"]. NEVER expand into individual items.\n3. NEVER say prices after each item. Say only \"Got it. Anything else?\" Prices read ONCE at Confirm Order.\n4. NEVER repeat the order mid-flow. Full readback ONCE at Confirm Order.\n5. 11. NEVER read back the order at any node except Confirm Order. No node should list items, totals, or order summaries. Every node says only \"would you like to get anything else? OR what else would you like?\" after pricing an item. The ONLY place the full order is read back is node Confirm Order \u2014 once, one time.\n6. NEVER add \"house special\", \"special\", or \"combo\" to item names. Use exact names from tools.\n7. NEVER loop or repeat the same sentence. If stuck, say \"One moment\" once, then continue or transfer.\n8. If a tool fails twice, say \"Let me transfer you\" and transfer immediately.\n9. Before every tool call, say a short filler under 5 words.\n10. NEVER go silent. If waiting more than 4 seconds, say a short filler.\n\nREQUIRED \u2014 always ask, never skip:\n  PIZZA: size, then toppings (or \"just cheese?\")\n  SUBS: which sub, fixins (\"What do you want on it?\"), cheese (if not mentioned, ask \"What cheese \u2014 American, provolone, or mozzarella?\")\n  BUFFALO WINGS: quantity, flavor (\"What flavor?\"), dressing (\"Ranch or blue cheese?\"). Never skip.\n  WHOLE WINGS: quantity only. No flavor or dressing.\n  SALADS: which, dressing\n  GYRO: chicken or lamb\n  SODA: flavor\n  \"Cheese sub\" is ambiguous \u2192 ask \"Cheese steak, cheese fish, or cheese burger sub?\"\n  \"Cheesesteak\" = regular Cheese Steak [684]. \"Philly cheesesteak\" = Philly [723]. If unclear, ask.\n  \"Hot\" = wing flavor [386]. \"Hot Sauce\" = dressing [696]. Don't confuse them.\n  Old Bay, seasoning salt \u2192 special_instructions, not modifier.\n  Regular Cold Cut = American Cold Cut. Regular Hot Cut = American Hot Cut.\n\n\nDEAL REFERENCE \u2014 when customer asks by name, route to deal node:\n  \"Double deal\" = 2 same-size cheese pizzas (1 top each). 12/14/16\" only. \u2192 Pizza Deals\n  \"3-Pizza Special\" = 3 same-size cheese pizzas (1 top each) + 2L soda. 14/16\" only. \u2192 Pizza Deals\n  \"Party Deal\" = 4 large pizzas + 48 wings + fries + 2L soda. \u2192 Pizza Deals\n  \"Family deal\" / \"Pizza and wings\" = pizza + 10 wings + 2L soda. 12/14/16\". \u2192 Pizza Wings Deal\n  \"Pizza and sub\" = pizza + half sub + fries + can soda. 12/14/16\". \u2192 Pizza Sub Deal\n  \"Combo deal\" = pizza + half sub + wings + 2 cans. 12\"=6 wings, 14\"=8 wings. \u2192 Pizza Sub Wings Deal\n  \"Sub combo\" = sub + fries + can soda. \u2192 Sub Deals\n  \"Wings special\" = 6 buffalo or 4 whole + fries + can soda. \u2192 Wings and Chicken Deals\n  \"Chicken box\" = 2 wing orders + 2 cans. No fries. \u2192 Wings and Chicken Deals\n  \"Burger combo\" = cheeseburger SANDWICH + fries + can soda. \u2192 Burger and Fish Deals\n  \"Fish combo\" = cheese fish SANDWICH + fries + can soda. \u2192 Burger and Fish Deals\n  Sub vs Sandwich: \"Sub\" in item name \u2192 sub deals. \"Sandwich\" \u2192 Burger/Fish combo.\n  Specialty pizzas NEVER qualify for deals.\n  Premium subs (Philly CS, Philly Chicken, CS Special, Shrimp CS, Shrimp Salad) excluded from pizza+sub, combo deal, wings+sub.\n  Collect ALL deal components BEFORE calling calculate_combo. NEVER guess prices.\n\nCOMBO FROM EXISTING ORDER: Pass EXACT item details from calculate_price to calculate_combo. Never change names, toppings, fixins, or cheese.\n12. PICKUP SPECIALS: For pickup orders, ALWAYS pass order_type=\"pickup\" to calculate_price. The server applies pickup pricing automatically. Do NOT calculate pickup prices yourself.\n11. NEVER read back the full order until Confirm Order node. Say ONLY \"Got it. Anything else?\"\n13. You MUST call calculate_price or calculate_combo BEFORE leaving any item or deal node. NEVER transition without pricing.",
    "nodes": [
      {
        "instruction": {
          "type": "prompt",
          "text": "Say \"Thanks for calling! Demo Pizza Is this for pickup or delivery?\"\nIf caller starts ordering, assume pickup."
        },
        "name": "Greeting",
        "edges": [
          {
            "condition": "Caller says delivery, deliver, or indicates they want delivery.",
            "id": "edge-1001",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller says delivery, deliver, or indicates they want delivery."
            },
            "destination_node_id": "node-2000"
          },
          {
            "condition": "Caller says pickup, pick up, carry out, or starts ordering items directly.",
            "id": "edge-1002",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller says pickup, pick up, carry out, or starts ordering items directly always confirm if its pickup or Delivery"
            },
            "destination_node_id": "node-3000"
          },
          {
            "destination_node_id": "node-9000",
            "id": "edge-1774310419052-7phzes2fz",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for manager, human, real person, want to know about previously place order, or wants to speak to someone."
            }
          }
        ],
        "start_speaker": "agent",
        "id": "start-node-1000",
        "type": "conversation",
        "display_position": {
          "x": -1386,
          "y": 246
        }
      },
      {
        "name": "Collect Delivery Address",
        "edges": [
          {
            "condition": "Caller has provided a delivery address.",
            "id": "edge-2001",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller has provided street address and zip code, and agent has confirmed."
            },
            "destination_node_id": "node-2500"
          },
          {
            "destination_node_id": "node-3000",
            "id": "edge-1774213861269-pgzh8zzbm",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller ask for pickup instead."
            }
          }
        ],
        "id": "node-2000",
        "type": "conversation",
        "display_position": {
          "x": -1386,
          "y": 798
        },
        "instruction": {
          "type": "prompt",
          "text": "Ask \"What's your street address and zip code for delivery?\"\n\nIf caller gives BOTH street and zip \u2192 say \"Got it, let me verify that.\" \nIf caller gives only street with NO zip \u2192 ask \"And what's the zip code?\"\nAfter getting zip \u2192 say \"Got it, let me verify that.\"\n\nIf the street name sounds unusual or unclear, ask the caller to spell it:\n\"Could you spell the street name for me?\"\nThis prevents transcription errors like \"Catherine\" \u2192 \"Kathleen\".\n\nDo NOT ask for city or state. Baltimore MD is automatic.\nDo NOT move to verify until you have at least a street address AND zip code."
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "Call verify_address with the street address and zip code caller provided. Server adds Baltimore MD automatically.\n\nFOUND \u2192 BEFORE confirming, CHECK if the returned street name matches what the caller said.\n  - Caller said \"Catherine\" but tool returned \"South St\" \u2192 DOES NOT MATCH.\n  - If street name is DIFFERENT: say \"I'm finding [returned address] \u2014 is that right, or is it a different street?\"\n  - If caller says no/different: ask them to spell the street name. Retry with spelled version.\n  - If street name MATCHES: \"Got it, delivering to [address].\" Move to Take Order.\n\nNOT_FOUND \u2192 Ask for zip code if not given. Retry. Still fails \u2192 ask to spell street name. After 3 tries, accept and move on.\nOUT_OF_RANGE \u2192 Tell distance. \"Would you like pickup instead?\"\nPARTIAL \u2192 Ask for house number. Try again.\n\nSTREET NAME VERIFICATION \u2014 CRITICAL:\nThe tool may return a similar but WRONG address. Always compare:\n- Caller said \"Catherine St\" \u2192 tool returns \"Catherine St\" \u2192 \u2705 MATCH\n- Caller said \"Catherine St\" \u2192 tool returns \"South St\" \u2192 \u274c WRONG \u2014 ask caller to confirm\n- Caller said \"Belvedere Ave\" \u2192 tool returns \"Belvedere Ave\" \u2192 \u2705 MATCH\n- Caller said \"Belvedere Ave\" \u2192 tool returns \"Belgrade St\" \u2192 \u274c WRONG \u2014 ask caller to confirm\n\nIf the street name in the tool response does NOT contain the same street name the caller said, DO NOT accept it. Ask the caller to spell it or confirm.\n\nNEVER ask for city or state. After 3 tries, accept and move on. Never block the order."
        },
        "name": "Verify Address",
        "edges": [
          {
            "condition": "Address has been verified and confirmed.",
            "id": "edge-2501",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Address has been verified and confirmed."
            },
            "destination_node_id": "node-3000"
          },
          {
            "condition": "Address could not be verified after 2 attempts, transfer to staff.",
            "id": "edge-2502",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Address could not be verified after 2 attempts, transfer to staff."
            },
            "destination_node_id": "node-9000"
          },
          {
            "condition": "Address is out of delivery range and caller wants pickup instead.",
            "id": "edge-2503",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Address is out of delivery range and caller wants pickup instead."
            },
            "destination_node_id": "node-3000"
          },
          {
            "condition": "Address is out of delivery range and caller does not want pickup.",
            "id": "edge-2504",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Address is out of delivery range and caller does not want pickup."
            },
            "destination_node_id": "node-7000"
          }
        ],
        "id": "node-2500",
        "tool_ids": [
          "tool-1773600060388"
        ],
        "type": "subagent",
        "display_position": {
          "x": 3150,
          "y": -1002
        }
      },
      {
        "name": "Take Order Hub",
        "edges": [
          {
            "condition": "",
            "id": "edge-3000-done",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer is done ordering: says that's it, that's all, nothing else, no, nope, I'm good, done, place the order. All items have been priced."
            },
            "destination_node_id": "node-1776204825245"
          },
          {
            "destination_node_id": "node-3100",
            "id": "edge-3000-pizza",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller mentions pizza or any specialty pizza name."
            }
          },
          {
            "destination_node_id": "node-3200",
            "id": "edge-3000-sub",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller mentions sub, cheesesteak, sandwich, wrap, or club."
            }
          },
          {
            "destination_node_id": "node-3300",
            "id": "edge-3000-other",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller mentions wings, nuggets, tenders, salad, gyro, seafood, pasta, sides, dessert, drinks, stromboli, quesadilla, or any other menu item."
            }
          },
          {
            "destination_node_id": "node-3510",
            "id": "edge-3000-dd",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for double deal, two pizza deal, three pizza special, party deal by name."
            }
          },
          {
            "destination_node_id": "node-3520",
            "id": "edge-3000-pw",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for pizza and wings deal or family deal by name."
            }
          },
          {
            "destination_node_id": "node-3530",
            "id": "edge-3000-ps",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for pizza and sub combo or pizza sub deal by name."
            }
          },
          {
            "destination_node_id": "node-3540",
            "id": "edge-3000-psw",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for combo deal (pizza+sub+wings) by name."
            }
          },
          {
            "destination_node_id": "node-3550",
            "id": "edge-3000-sd",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for sub combo, sub deal, or wings and sub by name."
            }
          },
          {
            "destination_node_id": "node-3560",
            "id": "edge-3000-wd",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for wings combo, wings special, or chicken box by name."
            }
          },
          {
            "destination_node_id": "node-3570",
            "id": "edge-3000-bf",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for burger combo or fish combo by name."
            }
          },
          {
            "destination_node_id": "node-3580",
            "id": "edge-3000-pu",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for pickup special by name."
            }
          },
          {
            "destination_node_id": "node-4000",
            "id": "edge-3000-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to change or remove an item."
            }
          },
          {
            "destination_node_id": "node-2000",
            "id": "edge-3000-delivery",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to switch to delivery."
            }
          },
          {
            "destination_node_id": "node-9000",
            "id": "edge-3000-transfer",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller asks for manager or is upset."
            }
          }
        ],
        "id": "node-3000",
        "type": "conversation",
        "display_position": {
          "x": -666,
          "y": -18
        },
        "instruction": {
          "type": "prompt",
          "text": "Ask \"What can I get for you?\" or \"Anything else?\"\nAll prices come from tools. Never guess prices.\nRoute: Pizza \u2192 Pizza Order. Sub/sandwich/wrap/club \u2192 Subs. Wings/salad/gyro/tenders/pasta/sides/dessert/drink \u2192 Wings and Other.\nDeal name \u2192 matching deal node.\nDone ordering \u2192 check for deals.\nDo NOT collect details for multiple items here. Route to the correct ordering node and let it handle one item at a time."
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "HARD RULE: Price ONE pizza per visit. You MUST call calculate_price before leaving this node.\nNEVER transition to Basket Manager without calling calculate_price first.\nAfter calculate_price returns, say \"Got it. Anything else?\"\nIf customer says yes or names another item, transition to Basket Manager.\nIf customer says no or done, transition to Basket Manager.\n\nIMPORTANT: If customer says \"add [topping]\" AFTER pricing, call calculate_price AGAIN with ALL toppings.\n\nCollect: size, then toppings (or \"just cheese?\").\nFree: Extra Sauce, Lite Sauce, Lite Cheese, No Sauce, WELLDONE.\nCall calculate_price with item_type=\"pizza\", size, toppings, order_type={{order_type}}.\nONE calculate_price call per item. Then LEAVE."
        },
        "name": "Pizza Order",
        "edges": [
          {
            "destination_node_id": "node-1776204817334",
            "id": "edge-3100-to-router",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_price tool returned successfully with item_name, item_id, and unit_price stored."
            }
          }
        ],
        "id": "node-3100",
        "tool_ids": [
          "tool-calc-price-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": -282,
          "y": -306
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "HARD RULE: Price ONE sub/sandwich/wrap per visit. You MUST call calculate_price before leaving this node.\nNEVER transition to Basket Manager without calling calculate_price first.\nAfter calculate_price returns, say \"Got it. Anything else?\"\nIf customer says yes or names another item, transition to Basket Manager.\nIf customer says no or done, transition to Basket Manager.\n\nIMPORTANT: If customer says \"add [fixin]\" AFTER pricing, call calculate_price AGAIN.\n\nSUBS: size (half/whole) then which sub then fixins (REQUIRED) then cheese (REQUIRED, ALWAYS ask).\n\"Cheese sub\" is ambiguous: ask \"Cheese steak, cheese fish, or cheese burger?\"\n\"Everything\" = [\"everything\"]. NEVER expand.\nCall calculate_price with item_type=\"sub\", sub_name, sub_size, fixins, cheese, order_type={{order_type}}.\nONE calculate_price call per item. Then LEAVE."
        },
        "name": "Subs and Sandwiches",
        "edges": [
          {
            "destination_node_id": "node-1776204817334",
            "id": "edge-3200-to-router",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_price tool returned successfully with item_name, item_id, and unit_price stored."
            }
          }
        ],
        "id": "node-3200",
        "tool_ids": [
          "tool-calc-price-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 846,
          "y": 774
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "HARD RULE: Price ONE item per visit. You MUST call calculate_price before leaving this node.\nNEVER transition to Basket Manager without calling calculate_price first.\nAfter calculate_price returns, say \"Got it. Anything else?\"\nIf customer says yes or names another item, transition to Basket Manager.\nIf customer says no or done, transition to Basket Manager.\n\nIMPORTANT: If customer says \"add [topping]\" AFTER pricing, call calculate_price AGAIN.\n\nSTROMBOLI/QUESADILLA: Ask about toppings. Toppings priced at medium pizza rate ($1.50 each).\nBUFFALO WINGS: Collect ALL THREE before tool: quantity, flavor, dressing.\nWHOLE WINGS: Quantity only. Do NOT ask flavor or dressing.\nOther items: Collect all details.\nCall calculate_price with all details, order_type={{order_type}}.\nONE calculate_price call per item. Then LEAVE."
        },
        "name": "Wings and Other Items",
        "edges": [
          {
            "destination_node_id": "node-1776204817334",
            "id": "edge-3300-to-router",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_price tool returned successfully with item_name, item_id, and unit_price stored."
            }
          }
        ],
        "id": "node-3300",
        "tool_ids": [
          "tool-calc-price-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 822,
          "y": 1638
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Double Deal, 3-Pizza Special, or Party Deal.\nUSE EXISTING ITEMS from basket. Do NOT collect new pizza details.\nTell customer the deal and price. YES: Call calculate_combo using already-priced details.\nNO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Pizza Deals",
        "edges": [
          {
            "condition": "",
            "id": "edge-3510-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3510-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3510-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3510",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 270,
          "y": -282
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Pizza and Wings (Family Deal) \u2014 pizza + 10 wings + 2L soda.\nUSE EXISTING ITEMS. Ask 2-liter flavor only if missing. Call calculate_combo.\nNO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Pizza Wings Deal",
        "edges": [
          {
            "condition": "",
            "id": "edge-3520-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3520-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3520-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3520",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 846,
          "y": -282
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Pizza and Sub Combo \u2014 pizza + half sub + fries + can soda.\nUSE EXISTING ITEMS. Ask soda flavor only. Call calculate_combo.\nNO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Pizza Sub Deal",
        "edges": [
          {
            "condition": "",
            "id": "edge-3530-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3530-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3530-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3530",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 1374,
          "y": -282
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Combo Deal \u2014 pizza + half sub + wings + 2 cans soda.\nUSE EXISTING ITEMS. Collect only MISSING details. Call calculate_combo.\nNO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Pizza Sub Wings Deal",
        "edges": [
          {
            "condition": "",
            "id": "edge-3540-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3540-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3540-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3540",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 1926,
          "y": -282
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Sub Combo, Wings and Sub, 2 Sub Combo, 3 Sub Combo.\nUSE EXISTING ITEMS. Ask soda flavor. For 2/3 sub: send sub_name_2, sub_fixins_2, sub_cheese_2.\nCall calculate_combo. NO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Sub Deals",
        "edges": [
          {
            "condition": "",
            "id": "edge-3550-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3550-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3550-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3550",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 1446,
          "y": 774
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Wings Special or Chicken Box.\nUSE EXISTING ITEMS. Ask soda flavor. Call calculate_combo.\nNO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Wings and Chicken Deals",
        "edges": [
          {
            "condition": "",
            "id": "edge-3560-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3560-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3560-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3560",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 1350,
          "y": 1638
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "DEAL: Burger Combo or Fish Combo \u2014 sandwich + fries + can soda.\nUSE EXISTING ITEMS. Ask soda flavor. Call calculate_combo.\nNO: Say \"No problem.\"\nFRIES RULE: If fries request, send as fries_instructions."
        },
        "name": "Burger and Fish Deals",
        "edges": [
          {
            "condition": "",
            "id": "edge-3570-accept",
            "transition_condition": {
              "type": "prompt",
              "prompt": "calculate_combo returned successfully."
            },
            "destination_node_id": "node-1776204817334"
          },
          {
            "condition": "",
            "id": "edge-3570-decline",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer declines the deal or says no."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "",
            "id": "edge-3570-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove an item."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3570",
        "tool_ids": [
          "tool-calc-combo-001"
        ],
        "type": "subagent",
        "display_position": {
          "x": 2046,
          "y": 774
        }
      },
      {
        "name": "Pickup Specials",
        "edges": [
          {
            "destination_node_id": "node-3100",
            "id": "edge-3580-pizza",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to order a pizza."
            }
          },
          {
            "destination_node_id": "node-3200",
            "id": "edge-3580-sub",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to order a sub, sandwich, wrap, or club."
            }
          },
          {
            "destination_node_id": "node-3300",
            "id": "edge-3580-other",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to order wings, nuggets, tenders, salad, gyro, seafood, pasta, sides, dessert, or drinks."
            }
          },
          {
            "destination_node_id": "node-5000",
            "id": "edge-3580-done",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller is done ordering: that's it, that's all, nothing else, no, nope, I'm good, I'm done, place the order. Move IMMEDIATELY to Confirm Order."
            }
          },
          {
            "destination_node_id": "node-4000",
            "id": "edge-3580-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to change or remove an item."
            }
          }
        ],
        "id": "node-3580",
        "type": "conversation",
        "display_position": {
          "x": -186,
          "y": 390
        },
        "instruction": {
          "type": "prompt",
          "text": "PICKUP SPECIALS \u2014 pickup orders ONLY. Prices applied automatically by server.\nAvailable specials:\n  10\" pizza with 1 free topping: $8.49\n  12\" cheese pizza: $8.99 (extra toppings $1.00 each)\n  14\" cheese pizza: $9.99 (extra toppings $1.50 each)\n  16\" cheese pizza: $10.99 (extra toppings $2.00 each)\n  8\" sub combo (sub + fries + soda): $11.99\n  12\" sub combo (sub + fries + soda): $15.99\n\nSay: \"You're getting the pickup special on that.\" Then \"Anything else?\"\nDo NOT offer these specials on delivery orders."
        }
      },
      {
        "name": "No Deal Continue",
        "edges": [
          {
            "condition": "",
            "id": "edge-3590-confirm",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer said done, that's it, nothing else, place the order."
            },
            "destination_node_id": "node-5000"
          },
          {
            "condition": "",
            "id": "edge-3590-more",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to add more items."
            },
            "destination_node_id": "node-3000"
          },
          {
            "condition": "",
            "id": "edge-3590-modify",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Customer wants to change or remove something."
            },
            "destination_node_id": "node-4000"
          }
        ],
        "id": "node-3590",
        "type": "conversation",
        "display_position": {
          "x": 1878,
          "y": 1638
        },
        "instruction": {
          "type": "prompt",
          "text": "Say \"Anything else?\" ONCE.\nIf customer says no, done \u2192 Confirm Order.\nIf customer wants more \u2192 Take Order Hub.\nDo NOT read back the order. Readback at Confirm Order ONLY."
        }
      },
      {
        "name": "Modify Order",
        "edges": [
          {
            "destination_node_id": "node-1776204817334",
            "id": "edge-4001",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller is done making changes."
            }
          }
        ],
        "id": "node-4000",
        "type": "conversation",
        "display_position": {
          "x": 2646,
          "y": -618
        },
        "instruction": {
          "type": "prompt",
          "text": "Caller wants to change order.\nIdentify item, make change, re-check combos. Confirm change, ask \"Anything else to change?\" "
        }
      },
      {
        "name": "Confirm Order",
        "edges": [
          {
            "destination_node_id": "node-6000",
            "id": "edge-pickup-bypass",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Order is PICKUP and caller confirmed the order."
            }
          },
          {
            "condition": "Caller confirms the order is correct: yes, yep, sounds good, that's right, correct, perfect.",
            "id": "edge-5001",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller confirms the order is correct: yes, yep, sounds good, that's right, correct, perfect."
            },
            "destination_node_id": "node-5500"
          },
          {
            "condition": "Caller wants to change something: no, wait, actually, can you change, remove the.",
            "id": "edge-5002",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to change something: no, wait, actually, can you change, remove the."
            },
            "destination_node_id": "node-4000"
          },
          {
            "condition": "Caller wants to add more items or delivery minimum not met.",
            "id": "edge-5003",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to add more items or delivery minimum not met."
            },
            "destination_node_id": "node-3000"
          },
          {
            "destination_node_id": "node-2000",
            "id": "edge-1774310554348-f95tmllef",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to switch to delivery, says \"deliver it\", \"actually make it delivery\"."
            }
          }
        ],
        "id": "node-5000",
        "type": "conversation",
        "display_position": {
          "x": 2670,
          "y": -162
        },
        "instruction": {
          "type": "prompt",
          "text": "Read back the COMPLETE order:\n\"Let me read that back.\"\n- Each item: name, size, details, price.\n- Combos: deal name, what's in it, deal price.\nUse EXACT prices from tools. Do NOT recalculate.\nSubtotal: {{subtotal}}. Tax: 6%. Total: subtotal \u00d7 1.06.\nDelivery adds $3 fee. Check $10 minimum for delivery.\n\"Does that sound good?\"\nYes + pickup \u2192 Submit Order.\nYes + delivery \u2192 Payment Method.\nChanges \u2192 Modify Order.\nAdd more \u2192 Take Order Hub."
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "If order is PICKUP:\n- Say \"You'll pay at the counter when you pick up.\" ONCE.\n- Immediately move to Submit Order. Do not wait for response.\n\nIf order is DELIVERY:\n- Ask \"Will that be cash or card?\"\n- CASH \u2192 move to Submit Order.\n- CARD \u2192 move to Collect Card Payment."
        },
        "name": "Payment Method",
        "edges": [
          {
            "condition": "Caller says cash, pay cash, cash at door, or indicates cash payment.",
            "id": "edge-5501",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller says cash, pay cash, cash at door, or indicates cash payment."
            },
            "destination_node_id": "node-6000"
          },
          {
            "condition": "Caller says card, credit card, debit card, pay with card, or indicates card payment.",
            "id": "edge-5502",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller says card, credit card, debit card, pay with card, or indicates card payment."
            },
            "destination_node_id": "node-5600"
          },
          {
            "condition": "Caller wants to change order or go back.",
            "id": "edge-5503",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to change order or go back."
            },
            "destination_node_id": "node-4000"
          },
          {
            "destination_node_id": "node-2000",
            "id": "edge-1774310977921-qent4fyic",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to switch to delivery or change their address."
            }
          },
          {
            "destination_node_id": "node-6000",
            "id": "edge-1774314134005-1w2tauaki",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Order is pickup and agent has already said pay at counter. Move immediately without waiting for caller response."
            }
          }
        ],
        "start_speaker": "agent",
        "id": "node-5500",
        "type": "conversation",
        "display_position": {
          "x": 2694,
          "y": 702
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "Collect card details one at a time:\n1. \"What's the card number?\" (confirm All digits back Always read Card numbers ONE DIGIT AT A TIME.)\n2. \"Expiration date?\" (month and year)\n3. \"The security code on the back?\" (3 or 4 digits)\n4. \"Billing zip code?\"\n\nAFTER collecting all 4 pieces, say \"Let me process that\" and IMMEDIATELY call process_payment.\nDo NOT try to validate card number length, expiration format, or CVV yourself.\nALWAYS call the tool \u2014 let it tell you if something is wrong.\n\nIf process_payment returns SUCCESS \u2192 \"Payment went through.\" Move to Submit Order.\n\nIf process_payment returns DECLINED \u2192 Read the reason to the caller:\n- \"I'm sorry, it looks like [reason from response].\"\n- \"Would you like to try another card or pay cash?\"\nAnother card \u2192 collect again. Cash \u2192 move to Submit Order.\n\nAfter 2 failed cards \u2192 say \"No problem, I'll set that to cash and submit your order, then transfer you to the counter.\"\nSet payment_method to \"cash\" and move to Submit Order.\n\nERROR \u2192 \"I'm having trouble processing the payment. Would you like to try again or pay cash?\"\n\n\nRead back the full card number. Expiration date CVV and zip. \n\nIf caller says \"pay cash\" or \"forget the card\" at ANY point \u2192 say \"No problem, we'll do cash.\" Move to Submit Order with payment_method cash.\n\nIf caller switches to cash \u2192 say \"No problem, we'll do cash.\" Set payment_method to \"cash\" when submitting.\n\nNEVER GO SILENT. If processing takes more than a few seconds, say \"Still processing, one moment.\"\nIf the tool fails or returns nothing, say \"I'm having trouble processing. Would you like to try again or pay cash?\"\n"
        },
        "name": "Collect Card Payment",
        "edges": [
          {
            "condition": "Payment approved successfully. process_payment returned SUCCESS.",
            "id": "edge-5601",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Payment approved successfully. process_payment returned SUCCESS."
            },
            "destination_node_id": "node-6000"
          },
          {
            "condition": "Card declined twice or caller wants to pay cash instead.",
            "id": "edge-5602",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller says \"pay cash\", \"I'll pay cash\", \"forget the card\", \"never mind\", \"just cash\", card declined twice, or caller wants cash instead."
            },
            "destination_node_id": "node-6000"
          },
          {
            "condition": "Caller is frustrated or wants to speak to someone.",
            "id": "edge-5603",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller is frustrated or wants to speak to someone.  Submit order as cash before transferring."
            },
            "destination_node_id": "node-6000"
          },
          {
            "destination_node_id": "node-6000",
            "id": "edge-1774328802284-pq52q97pw",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Card declined twice and caller does not want to try again. Submit order as cash before transferring."
            }
          }
        ],
        "start_speaker": "agent",
        "id": "node-5600",
        "tool_ids": [
          "tool-1774237206098"
        ],
        "type": "subagent",
        "display_position": {
          "x": 3246,
          "y": 726
        }
      },
      {
        "instruction": {
          "type": "prompt",
          "text": "Never ask caller's name. Call get_caller_id FIRST.\nIf returns phone \u2192 read back, confirm. If wrong \u2192 ask for number.\nIf returns NO_PHONE \u2192 ask for phone number.\nThen ask for name for the order.\n\nThen call submit_order with:\n  order_type: \"pickup\" or \"delivery\"\n  customer_name: the name they gave\n  customer_phone: confirmed phone number\n  items: Use the EXACT data from calculate_price and calculate_combo tool results stored in conversation. For EACH item include: item_name, item_id, unit_price, quantity, modifiers array, is_combo. For combos: include components array exactly as calculate_combo returned.\n  subtotal: {{subtotal}}\n  tax: multiply subtotal by 0.06\n  total: subtotal + tax (+ delivery fee if delivery)\n\nCRITICAL: You MUST call submit_order. Do NOT skip it. Do NOT end the call without submitting.\nAfter submit_order returns reference number: \"Your order is placed, reference number [NUMBER]. Pickup in fifteen to twenty minutes. Thanks for calling!\"\nThen end call immediately."
        },
        "name": "Submit Order",
        "edges": [
          {
            "condition": "Order has been submitted successfully and caller has been informed.",
            "id": "edge-6001",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Order has been submitted successfully and caller has been informed. Agent said thanks for calling"
            },
            "destination_node_id": "node-8000"
          },
          {
            "destination_node_id": "node-5600",
            "id": "edge-1774311189077-dw20cwjus",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller changes mind and wants to pay by card instead of cash."
            }
          },
          {
            "destination_node_id": "node-9000",
            "id": "edge-1774325312200-6wpx3n515",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller is frustrated or wants to speak to someone."
            }
          },
          {
            "destination_node_id": "node-9000",
            "id": "edge-1774328944466-cr7994bp9",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Order was submitted after card payment failure and needs to transfer to counter."
            }
          },
          {
            "destination_node_id": "node-4000",
            "id": "edge-1774670024549-45dxj68wh",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to modify order Add or Remove any item  before reference number is provided."
            }
          }
        ],
        "id": "node-6000",
        "tool_ids": [
          "tool-1773371749507",
          "tool-1774319398952"
        ],
        "type": "subagent",
        "display_position": {
          "x": 3150,
          "y": -186
        }
      },
      {
        "name": "Goodbye",
        "edges": [
          {
            "destination_node_id": "node-8000",
            "id": "edge-1774314424102-x85pabnb2",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Agent has said goodbye or thanks for calling."
            }
          },
          {
            "destination_node_id": "node-9500",
            "id": "edge-1774325465357-mxygqme70",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller is frustrated or wants to speak to someone."
            }
          }
        ],
        "id": "node-7000",
        "type": "conversation",
        "display_position": {
          "x": 3870,
          "y": -162
        },
        "instruction": {
          "type": "prompt",
          "text": "Say \"Thank You! Have a great day!\" then immediately end the call. Do not say anything else. Do not wait for a response."
        }
      },
      {
        "name": "End Call",
        "id": "node-8000",
        "type": "end",
        "display_position": {
          "x": 5022,
          "y": 366
        },
        "instruction": {
          "type": "prompt",
          "text": "End the call."
        }
      },
      {
        "transfer_destination": {
          "type": "predefined",
          "number": "+16672073390"
        },
        "edge": {
          "condition": "Transfer failed",
          "id": "edge-9001",
          "transition_condition": {
            "type": "prompt",
            "prompt": "Transfer failed"
          },
          "destination_node_id": "node-9500"
        },
        "instruction": {
          "type": "prompt",
          "text": "Transfer the call to a staff member."
        },
        "name": "Transfer to Staff",
        "global_node_setting": {
          "condition": "When the caller is angry, frustrated, requests a human agent, asks to speak to a manager, or says let me talk to a person."
        },
        "id": "node-9000",
        "transfer_option": {
          "opt_out_initial_message": false,
          "on_hold_music": "ringtone",
          "transfer_ring_duration_ms": 90000,
          "opt_out_human_detection": false,
          "enable_bridge_audio_cue": false,
          "type": "warm_transfer",
          "agent_detection_timeout_ms": 30000,
          "show_transferee_as_caller": false
        },
        "type": "transfer_call",
        "display_position": {
          "x": -1914,
          "y": 342
        }
      },
      {
        "name": "Transfer Failed",
        "edges": [
          {
            "condition": "Caller wants to continue ordering.",
            "id": "edge-9501",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to continue ordering."
            },
            "destination_node_id": "node-3000"
          },
          {
            "condition": "Caller wants to end the call.",
            "id": "edge-9502",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Caller wants to end the call."
            },
            "destination_node_id": "node-7000"
          },
          {
            "destination_node_id": "node-9000",
            "id": "edge-1774315653768-h15xmfihs",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Transfer failed or could not connect to staff."
            }
          }
        ],
        "id": "node-9500",
        "type": "conversation",
        "display_position": {
          "x": -1914,
          "y": 846
        },
        "instruction": {
          "type": "prompt",
          "text": "Say \"I wasn't able to reach staff. I can help you order, or we can try again.\"\nContinue based on caller's choice."
        }
      },
      {
        "code": "let items = [];\ntry { items = JSON.parse(dv.basket || \"[]\"); } catch(e) { items = []; }\nconst DEALS = [769,770,771,772,773,774,775,776,777,778,780,781,782,783,784,786,787,788,793,794,831,838,839,840,744,847];\nconst name = dv.new_item_name;\nconst price = parseFloat(dv.new_item_price) || 0;\nconst itemId = dv.new_item_id || \"\";\nconst pid = dv.pricing_id || \"none\";\nconst lastPid = dv.last_pricing_id || \"none\";\nconst isNew = pid !== \"none\" && pid !== lastPid;\nif (isNew && name && name !== \"undefined\" && name !== \"none\" && price > 0) {\n  const isCombo = DEALS.includes(parseInt(itemId));\n  const newItem = {\n    item_name: name, item_id: itemId, unit_price: price,\n    category: isCombo ? \"Combo\" : (dv.new_item_category || \"\"),\n    quantity: 1, is_combo: isCombo\n  };\n  if (isCombo) {\n    newItem.deal_id = itemId;\n    const CC = [\"pizzas\",\"submarines\",\"wings\",\"sides\",\"beverages\",\"sandwiches\"];\n    items = items.filter(it => it.is_combo || CC.indexOf((it.category||\"\").toLowerCase()) === -1);\n    items.push(newItem);\n  } else {\n    items.push(newItem);\n  }\n}\nlet sub = 0;\nfor (const it of items) sub += (parseFloat(it.unit_price)||0) * (parseInt(it.quantity)||1);\nsub = Math.round(sub * 100) / 100;\nreturn { basket: JSON.stringify(items), item_count: items.length, subtotal: sub, last_pricing_id: pid };",
        "else_edge": {
          "destination_node_id": "node-3000",
          "id": "edge-1776204817334-0vdmq6gcq",
          "transition_condition": {
            "type": "prompt",
            "prompt": "Else"
          }
        },
        "name": "Basket Manager",
        "edges": [
          {
            "condition": "",
            "id": "edge-bm-hub",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Basket updated. Return to ordering."
            },
            "destination_node_id": "node-3000"
          }
        ],
        "response_variables": {
          "basket": "basket",
          "item_count": "item_count",
          "subtotal": "subtotal",
          "last_pricing_id": "last_pricing_id"
        },
        "id": "node-1776204817334",
        "type": "code",
        "speak_during_execution": false,
        "display_position": {
          "x": -114,
          "y": 1302
        },
        "wait_for_result": true
      },
      {
        "code": "const items=JSON.parse(dv.basket||\"[]\");\nlet dec=JSON.parse(dv.declined_deals||\"[]\");\nconst prev=dv.deal_match||\"none\";\nif(prev!==\"none\"&&dec.indexOf(prev)===-1){\nconst hasCombo=items.some(it=>it.is_combo);\nif(!hasCombo)dec.push(prev);\n}\nconst PR=[723,724,725,726,710];\nlet pz=[],su=[],bw=0,ww=0,fr=0,cn=0,tl=0,bg=0,fi=0;\nfor(const it of items){\nif(it.is_combo)continue;\nconst nm=(it.item_name||\"\").toLowerCase();\nconst id=parseInt(it.item_id)||0;\nconst ct=(it.category||\"\").toLowerCase();\nif(ct===\"pizzas\"&&nm.includes(\"cheese pizza\")){const m=nm.match(/(\\d+)\\s*inch/);pz.push(m?parseInt(m[1]):14);}\nif(ct===\"submarines\")su.push({sz:nm.includes(\"12 inch\")?12:8,id,pr:PR.indexOf(id)!==-1});\nif(nm.includes(\"buffalo\")&&ct===\"wings\")bw+=parseInt(nm)||0;\nif(nm.includes(\"whole\")&&ct===\"wings\")ww+=parseInt(nm)||0;\nif(nm.includes(\"fries\")||ct===\"sides\")fr++;\nif(nm.includes(\"can soda\"))cn++;\nif(nm.includes(\"2 liter\"))tl++;\nif(nm.includes(\"burger sandwich\")||nm.includes(\"cheeseburger\"))bg++;\nif(nm.includes(\"fish sandwich\"))fi++;\n}\nconst rg=su.filter(s=>!s.pr);\nconst no=d=>dec.indexOf(d)!==-1;\nlet dm=null,sg=\"\",dn=\"node-3590\";\nif(pz.length>=4&&bw>=48&&fr&&tl&&!no(\"party\")){dm=\"party_deal\";dn=\"node-3510\";}\nelse if(pz.length>=3&&pz[0]===pz[1]&&pz[1]===pz[2]&&[14,16].includes(pz[0])&&tl&&!no(\"3pz\")){dm=\"3_pizza\";dn=\"node-3510\";}\nelse if(pz.length>=2&&pz[0]===pz[1]&&[12,14,16,18].includes(pz[0])&&!no(\"dd\")){dm=\"double_deal\";dn=\"node-3510\";}\nelse if(pz.length>=1&&rg.length>=1&&bw>0&&cn>=2&&!no(\"combo\")){dm=\"combo_deal\";dn=\"node-3540\";}\nelse if(pz.length>=1&&bw>0&&tl>0&&!no(\"pw\")){dm=\"pizza_wings\";dn=\"node-3520\";}\nelse if(pz.length>=1&&rg.length>=1&&fr>0&&cn>0&&!no(\"ps\")){dm=\"pizza_sub\";dn=\"node-3530\";}\nelse if(rg.length>=1&&bw>=6&&cn>0&&!no(\"ws\")){dm=\"wings_sub\";dn=\"node-3550\";}\nelse if(su.length>=3&&fr>=3&&cn>=3&&!no(\"3sc\")){dm=\"3_sub_combo\";dn=\"node-3550\";}\nelse if(su.length>=2&&fr>=2&&cn>=2&&!no(\"2sc\")){dm=\"2_sub_combo\";dn=\"node-3550\";}\nelse if(su.length>=1&&fr>0&&cn>0&&!no(\"sc\")){dm=\"sub_combo\";dn=\"node-3550\";}\nelse if(bw>=12&&cn>=2&&!no(\"cbb\")){dm=\"chicken_box_buffalo\";dn=\"node-3560\";}\nelse if(ww>=8&&cn>=2&&!no(\"cbw\")){dm=\"chicken_box_whole\";dn=\"node-3560\";}\nelse if(bw===6&&fr&&cn&&!no(\"wsb\")){dm=\"wings_special_buffalo\";dn=\"node-3560\";}\nelse if(ww===4&&fr&&cn&&!no(\"wsw\")){dm=\"wings_special_whole\";dn=\"node-3560\";}\nelse if(bg&&fr&&cn&&!no(\"bc\")){dm=\"burger_combo\";dn=\"node-3570\";}\nelse if(fi&&fr&&cn&&!no(\"fc\")){dm=\"fish_combo\";dn=\"node-3570\";}\nif(!dm){\nif(pz.length>=1&&rg.length>=1&&bw>0&&cn<2&&!no(\"combo\")){dm=\"near_combo\";sg=\"Add two cans for the combo deal?\";dn=\"node-3540\";}\nelse if(pz.length>=2&&pz[0]===pz[1]&&!no(\"dd\")){dm=\"near_dd\";sg=\"Double deal?\";dn=\"node-3510\";}\nelse if(pz.length>=1&&bw>0&&!tl&&!no(\"pw\")){dm=\"near_pw\";sg=\"Family deal with a two-liter?\";dn=\"node-3520\";}\nelse if(pz.length>=1&&rg.length>=1&&(!fr||!cn)&&!no(\"ps\")){dm=\"near_ps\";sg=\"Pizza sub combo?\";dn=\"node-3530\";}\nelse if(rg.length>=1&&bw>=6&&!no(\"ws\")){dm=\"near_ws\";sg=\"Wings and sub deal?\";dn=\"node-3550\";}\nelse if(su.length>=3&&(!fr||!cn)&&!no(\"3sc\")){dm=\"near_3sc\";sg=\"Three sub combo with fries and sodas?\";dn=\"node-3550\";}\nelse if(su.length>=2&&(!fr||!cn)&&!no(\"2sc\")){dm=\"near_2sc\";sg=\"Two sub combo with fries and sodas?\";dn=\"node-3550\";}\nelse if(su.length===1&&(!fr||!cn)&&!no(\"sc\")){dm=\"near_sc\";sg=\"Sub combo with fries and soda?\";dn=\"node-3550\";}\nelse if(bw===6&&(!fr||!cn)&&!no(\"wsb\")){dm=\"near_wbuf\";sg=\"Wings special with fries and soda?\";dn=\"node-3560\";}\nelse if(ww===4&&(!fr||!cn)&&!no(\"wsw\")){dm=\"near_wwhole\";sg=\"Wings special?\";dn=\"node-3560\";}\nelse if(bg&&(!fr||!cn)&&!no(\"bc\")){dm=\"near_bc\";sg=\"Burger combo?\";dn=\"node-3570\";}\nelse if(fi&&(!fr||!cn)&&!no(\"fc\")){dm=\"near_fc\";sg=\"Fish combo?\";dn=\"node-3570\";}\n}\nreturn {deal_match:dm||\"none\",suggestion:sg,deal_node:dn,declined_deals:JSON.stringify(dec)};",
        "else_edge": {
          "destination_node_id": "node-3590",
          "id": "edge-1776204825245-05b1kovau",
          "transition_condition": {
            "type": "prompt",
            "prompt": "Else"
          }
        },
        "instruction": {
          "type": "static_text",
          "text": "One moment."
        },
        "name": "Combo Checker",
        "edges": [
          {
            "condition": "{{deal_match}} == \"none\"",
            "id": "edge-cc-none",
            "transition_condition": {
              "type": "prompt",
              "prompt": "No deal found."
            },
            "destination_node_id": "node-3590"
          },
          {
            "condition": "\"double_deal,3_pizza,party_deal,near_dd\" CONTAINS {{deal_match}}",
            "id": "edge-cc-pizza",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Pizza deals."
            },
            "destination_node_id": "node-3510"
          },
          {
            "condition": "\"pizza_wings,near_pw\" CONTAINS {{deal_match}}",
            "id": "edge-cc-pw",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Pizza wings."
            },
            "destination_node_id": "node-3520"
          },
          {
            "condition": "\"pizza_sub,near_ps\" CONTAINS {{deal_match}}",
            "id": "edge-cc-ps",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Pizza sub."
            },
            "destination_node_id": "node-3530"
          },
          {
            "condition": "\"combo_deal,near_combo\" CONTAINS {{deal_match}}",
            "id": "edge-cc-psw",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Combo deal."
            },
            "destination_node_id": "node-3540"
          },
          {
            "condition": "\"sub_combo,wings_sub,2_sub_combo,3_sub_combo,near_sc,near_ws,near_2sc,near_3sc\" CONTAINS {{deal_match}}",
            "id": "edge-cc-sub",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Sub deals."
            },
            "destination_node_id": "node-3550"
          },
          {
            "condition": "\"wings_special_buffalo,wings_special_whole,chicken_box_buffalo,chicken_box_whole,near_wbuf,near_wwhole\" CONTAINS {{deal_match}}",
            "id": "edge-cc-wing",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Wings deals."
            },
            "destination_node_id": "node-3560"
          },
          {
            "condition": "\"burger_combo,fish_combo,near_bc,near_fc\" CONTAINS {{deal_match}}",
            "id": "edge-cc-bf",
            "transition_condition": {
              "type": "prompt",
              "prompt": "Burger fish deals."
            },
            "destination_node_id": "node-3570"
          }
        ],
        "response_variables": {
          "declined_deals": "declined_deals",
          "deal_match": "deal_match",
          "suggestion": "suggestion"
        },
        "id": "node-1776204825245",
        "type": "code",
        "speak_during_execution": true,
        "display_position": {
          "x": 318,
          "y": 726
        },
        "wait_for_result": true
      }
    ],
    "components": [
      {
        "name": "Component L1",
        "start_node_id": "conversation-1773372115393",
        "nodes": [
          {
            "name": "Conversation",
            "edges": [],
            "id": "conversation-1773372115393",
            "type": "conversation",
            "display_position": {
              "x": 200,
              "y": 100
            },
            "instruction": {
              "type": "prompt",
              "text": "Describe what the AI should say or do"
            }
          },
          {
            "name": "Exit Component",
            "id": "component-end-1773372115393",
            "type": "end",
            "speak_during_execution": false,
            "display_position": {
              "x": 600,
              "y": 100
            },
            "instruction": {
              "type": "static_text",
              "text": "Component completed"
            }
          }
        ],
        "tools": []
      }
    ],
    "start_node_id": "start-node-1000",
    "start_speaker": "agent",
    "tools": [
      {
        "headers": {},
        "parameter_type": "json",
        "execution_message_type": "static_text",
        "method": "POST",
        "query_params": {},
        "description": "Submit order to POS system.",
        "type": "custom",
        "url": "https://supermenu-pos-bridge.onrender.com/retell/function/submit_order",
        "tool_id": "tool-1773371749507",
        "args_at_root": false,
        "execution_message_description": "Placing the order now.",
        "timeout_ms": 120000,
        "speak_after_execution": true,
        "name": "submit_order",
        "response_variables": {},
        "speak_during_execution": true,
        "parameters": {
          "type": "object",
          "required": [
            "order_type",
            "customer_name",
            "customer_phone",
            "items",
            "subtotal"
          ],
          "properties": {
            "delivery_address": {
              "type": "string",
              "description": "Full address with city, state, zip. Only for delivery."
            },
            "total": {
              "type": "number",
              "description": "Final total including tax and delivery fee."
            },
            "special_instructions": {
              "type": "string",
              "description": "Overall order notes."
            },
            "subtotal": {
              "type": "number",
              "description": "Sum of all item unit_price x quantity before tax."
            },
            "customer_phone": {
              "type": "string",
              "description": "Phone number confirmed with caller."
            },
            "tax": {
              "type": "number",
              "description": "Tax amount at 6%."
            },
            "customer_name": {
              "type": "string",
              "description": "Full name for the order."
            },
            "order_type": {
              "type": "string",
              "description": "pickup or delivery."
            },
            "items": {
              "type": "array",
              "description": "All items in the order.",
              "items": {
                "type": "object",
                "properties": {
                  "is_combo": {
                    "type": "boolean",
                    "description": "True if this is a combo deal. Must use components array for combo items."
                  },
                  "special_instructions": {
                    "type": "string",
                    "description": "Special requests for this item."
                  },
                  "components": {
                    "type": "array",
                    "description": "Combo components. Required when is_combo is true. Each component must have its own item_id, component_name, and modifiers. Never mix all modifiers into the parent item. Each pizza, sub, wings, fries, soda must be a separate component.",
                    "items": {
                      "type": "object",
                      "properties": {
                        "special_instructions": {
                          "type": "string",
                          "description": "Special requests for this component."
                        },
                        "modifiers": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "name": {
                                "type": "string",
                                "description": "Modifier value like Pepperoni, Everything, Hot, American."
                              },
                              "price": {
                                "type": "number",
                                "description": "0 for the 1 free topping per combo pizza, sub fixins, cheese, wing flavor, wing dressing, and soda flavor. Actual KB price for extra pizza toppings beyond the 1 free and paid sub extras like extra meat, bacon, shrimp. These charges must ALSO be added to the combo unit_price."
                              },
                              "group": {
                                "type": "string",
                                "description": "Must be exactly one of: Add Toppings, Sub Fixins, Cheese Options, Wings - Flavors, Wings - Dressing, Soda Can, Salad Dressing, Tender Sauce, Gyro Meat. Never make up group names."
                              }
                            }
                          }
                        },
                        "item_id": {
                          "type": "string",
                          "description": "Numeric POS ID from KB for this component. Pizza: 735-739 by size. Sub: use sub ID like 684. Wings: use wing ID like 579. Fries: 607. Can Soda: 728. 2 Liter Soda: 790. Never guess. Never use 0."
                        },
                        "component_name": {
                          "type": "string",
                          "description": "Name with size from KB. Examples: 14 inch Lrg Cheese Pizza, 8 inch Half Cheese Steak Sub, 6pcs Buffalo wings, French Fries, Can Soda."
                        }
                      }
                    }
                  },
                  "quantity": {
                    "type": "integer",
                    "description": "Number of this item."
                  },
                  "item_id": {
                    "type": "string",
                    "description": "Numeric POS item ID from KB. For regular items use the item ID. For combo items use the combo deal ID from KB. Never text IDs. Never guess."
                  },
                  "item_name": {
                    "type": "string",
                    "description": "Item name with size included. Examples: 14 inch Lrg Cheese Pizza, 8 inch Half Cheese Steak Sub, 6pcs Buffalo wings. Never add house special, combo, or deal to the name."
                  },
                  "unit_price": {
                    "type": "number",
                    "description": "For regular items: base price plus all topping charges combined. For combo items: deal base price plus any extra topping charges beyond the 1 free per pizza, plus any paid sub extras like extra meat, bacon, shrimp. All extra charges must be added to unit_price. Example: Pizza Sub Combo 14 inch base 24.99, customer adds 2 extra pizza toppings at 2.00 each plus extra meat 1.00 on sub, unit_price = 29.99"
                  },
                  "modifiers": {
                    "type": "array",
                    "description": "Modifiers for regular non-combo items only. Use empty array for combo items. Combo modifiers go inside each component.",
                    "items": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string",
                          "description": "Modifier value like Pepperoni, Everything, American."
                        },
                        "price": {
                          "type": "number",
                          "description": "Modifier charge from KB. Use 0 for free options like WELLDONE, Lite Sauce, Extra Sauce, and for sub fixins, cheese, wing flavors, dressing, soda flavor."
                        },
                        "group": {
                          "type": "string",
                          "description": "Must be exactly one of: Add Toppings, Sub Fixins, Cheese Options, Wings - Flavors, Wings - Dressing, Soda Can, Salad Dressing, Tender Sauce, Gyro Meat. Never make up group names."
                        }
                      }
                    }
                  }
                }
              }
            },
            "payment_method": {
              "type": "string",
              "description": "cash or card."
            },
            "payment_ref": {
              "type": "string",
              "description": "Auth code from process_payment if card payment."
            }
          }
        }
      },
      {
        "headers": {},
        "parameter_type": "json",
        "execution_message_type": "prompt",
        "method": "POST",
        "query_params": {},
        "description": "Verify delivery address and check delivery range.",
        "type": "custom",
        "url": "https://supermenu-pos-bridge.onrender.com/retell/function/verify_address",
        "tool_id": "tool-1773600060388",
        "args_at_root": false,
        "execution_message_description": "Checking that address.",
        "timeout_ms": 120000,
        "speak_after_execution": true,
        "name": "verify_address",
        "response_variables": {},
        "speak_during_execution": true,
        "parameters": {
          "type": "object",
          "required": [
            "address"
          ],
          "properties": {
            "address": {
              "type": "string",
              "description": "Full delivery address with city, state, zip."
            }
          }
        }
      },
      {
        "headers": {},
        "parameter_type": "json",
        "execution_message_type": "prompt",
        "method": "POST",
        "query_params": {},
        "description": "",
        "type": "custom",
        "url": "https://supermenu-pos-bridge.onrender.com/retell/function/process_payment",
        "tool_id": "tool-1774237206098",
        "args_at_root": false,
        "execution_message_description": "Processing that now.",
        "timeout_ms": 120000,
        "speak_after_execution": true,
        "name": "process_payment",
        "response_variables": {},
        "speak_during_execution": true,
        "parameters": {
          "type": "object",
          "required": [
            "card_number",
            "expiration",
            "cvv",
            "amount"
          ],
          "properties": {
            "zip": {
              "type": "string",
              "description": "Billing zip code."
            },
            "expiration": {
              "type": "string",
              "description": "Expiration in MMYY format. Example: 1228 for Dec 2028."
            },
            "cvv": {
              "type": "string",
              "description": "3 or 4 digit security code from back of card."
            },
            "amount": {
              "type": "string",
              "description": "Total amount to charge. Example: 29.99"
            },
            "invoice": {
              "type": "string",
              "description": "Order reference number."
            },
            "card_number": {
              "type": "string",
              "description": "Full card number, 13-19 digits."
            }
          }
        }
      },
      {
        "headers": {},
        "parameter_type": "json",
        "method": "POST",
        "query_params": {},
        "description": "",
        "type": "custom",
        "url": "https://supermenu-pos-bridge.onrender.com/retell/function/get_caller_id",
        "tool_id": "tool-1774319398952",
        "args_at_root": false,
        "execution_message_description": "Pulling your number.",
        "timeout_ms": 120000,
        "speak_after_execution": true,
        "name": "get_caller_id",
        "response_variables": {},
        "speak_during_execution": true,
        "parameters": {
          "type": "object",
          "properties": {}
        }
      },
      {
        "headers": {},
        "parameter_type": "json",
        "execution_message_type": "static_text",
        "method": "POST",
        "query_params": {},
        "description": "Calculate exact price, item ID, and modifiers for ANY menu item \u2014 pizza, sub, sandwich, wrap, wings, salad, gyro, tenders, nuggets, seafood, pasta, stromboli, quesadilla, sides, dessert, drink. Call this EVERY TIME a customer orders any item. Returns exact data for submit_order. Never calculate prices yourself.",
        "type": "custom",
        "url": "https://supermenu-pos-bridge.onrender.com/retell/function/calculate_price",
        "tool_id": "tool-calc-price-001",
        "args_at_root": false,
        "execution_message_description": "Checking that.",
        "timeout_ms": 10000,
        "speak_after_execution": true,
        "name": "calculate_price",
        "response_variables": {
          "new_item_name": "item_name",
          "new_item_id": "item_id",
          "new_item_price": "unit_price",
          "new_item_category": "category",
          "pricing_id": "pricing_id"
        },
        "speak_during_execution": true,
        "parameters": {
          "type": "object",
          "required": [
            "item_type"
          ],
          "properties": {
            "tender_sauce": {
              "type": "string",
              "description": "Tender sauce: Honey Mustard, Blue Cheese, Honey BBQ, Ranch."
            },
            "special_instructions": {
              "type": "string",
              "description": "Special requests like Old Bay, well done, extra crispy, cut in half, oil and vinegar."
            },
            "sub_name": {
              "type": "string",
              "description": "Sub name EXACTLY as customer said. Include EVERY word \u2014 shrimp, philly, chicken. Required for sub orders."
            },
            "quantity": {
              "type": "integer",
              "description": "Piece count for wings, nuggets, tenders, seafood. Example: 6 for 6 piece wings."
            },
            "wing_dressing": {
              "type": "string",
              "description": "Wing dressing: Ranch, Blue Cheese, Hot Sauce."
            },
            "item_type": {
              "type": "string",
              "description": "Must be one of: pizza, specialty pizza, sub, sandwich, wrap, wings, salad, gyro, tenders, drink, or the item category name like nuggets, seafood, pasta, stromboli, quesadilla, sides, dessert, club, platter."
            },
            "item_name": {
              "type": "string",
              "description": "Item name EXACTLY as customer said. Include EVERY word. Examples: shrimp cheese steak, garden salad, 6 piece buffalo wings, chicken alfredo, french fries, can soda, chocolate cake. CRITICAL: never drop words like shrimp, philly, chicken, grilled, crispy."
            },
            "sub_size": {
              "type": "string",
              "description": "'half' for 8 inch or 'whole' for 12 inch. Default: half."
            },
            "pizza_name": {
              "type": "string",
              "description": "For specialty pizza only. Name like: Deluxe, Supreme, Veggie, Hawaiian, Steak, Meat Lover, BBQ Chicken, Buffalo Chicken."
            },
            "cheese": {
              "type": "string",
              "description": "Cheese choice: American, Provolone, Mozzarella, Feta Cheese, No Cheese, Extra Cheese."
            },
            "gyro_meat": {
              "type": "string",
              "description": "Gyro meat: Chicken or Lamb."
            },
            "size": {
              "type": "integer",
              "description": "Pizza size in inches: 10, 12, 14, 16, or 18. Required for pizza only."
            },
            "fixins": {
              "type": "array",
              "description": "Fixins for subs, sandwiches, wraps, or gyros.",
              "items": {
                "type": "string"
              }
            },
            "toppings": {
              "type": "array",
              "description": "Pizza toppings only.",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "description": "Topping name: Pepperoni, Mushroom, Sausage, Ham, Bacon, etc."
                  },
                  "half": {
                    "type": "boolean",
                    "description": "True if topping is on half the pizza only."
                  }
                }
              }
            },
            "soda_flavor": {
              "type": "string",
              "description": "Soda flavor: Pepsi, Coke, Diet Coke, Sprite, Mountain Dew, Dr Pepper, etc."
            },
            "salad_dressing": {
              "type": "string",
              "description": "Salad dressing: Ranch, Blue Cheese, Creamy Italian, Thousand Island, Caesar, Balsamic Vinaigrette, French."
            },
            "order_type": {
              "type": "string",
              "description": "pickup or delivery. REQUIRED for correct pricing \u2014 pickup orders get special pricing on pizzas."
            },
            "wing_flavor": {
              "type": "string",
              "description": "Wing flavor: Mild, Hot, Extra Hot, BBQ, Honey BBQ, Lemon Pepper, Old Bay, Garlic Parmesan, Mango Habanero, etc."
            }
          }
        }
      },
      {
        "headers": {},
        "parameter_type": "json",
        "execution_message_type": "static_text",
        "method": "POST",
        "query_params": {},
        "description": "Calculate exact price, deal ID, component IDs, and all modifiers for a combo deal. Call this EVERY TIME a combo deal is applied. Handles the 1 free topping rule, extra topping charges, sub name matching, and returns the exact unit_price and components. Never calculate combo prices yourself.",
        "type": "custom",
        "url": "https://supermenu-pos-bridge.onrender.com/retell/function/calculate_combo",
        "tool_id": "tool-calc-combo-001",
        "args_at_root": false,
        "execution_message_description": "Checking the deal.",
        "timeout_ms": 10000,
        "speak_after_execution": true,
        "name": "calculate_combo",
        "response_variables": {
          "new_item_name": "item_name",
          "new_item_id": "deal_id",
          "new_item_price": "unit_price",
          "pricing_id": "pricing_id"
        },
        "speak_during_execution": true,
        "parameters": {
          "type": "object",
          "required": [
            "deal_type"
          ],
          "properties": {
            "sub_name": {
              "type": "string",
              "description": "Sub name EXACTLY as customer said. Include EVERY word \u2014 shrimp, philly, chicken. Premium subs (philly cs, philly chicken, cs special, shrimp cs, shrimp salad) are NOT allowed in pizza+sub, combo deal, or wings+sub deals."
            },
            "wing_dressing": {
              "type": "string",
              "description": "Wing dressing: Ranch, Blue Cheese, Hot Sauce."
            },
            "deal_type": {
              "type": "string",
              "description": "Must be exactly one of: double deal, 3 pizza special, three pizza special, pizza and wings, family deal, pizza and sub, pizza sub combo, combo deal, sub combo, 2 sub combo, two sub combo, 3 sub combo, three sub combo, wings and sub, wings special buffalo, wings special whole, chicken box whole, chicken box buffalo, burger combo, fish combo, party deal."
            },
            "two_liter_flavor": {
              "type": "string",
              "description": "Flavor for 2-liter soda if combo includes one."
            },
            "pizza_size": {
              "type": "integer",
              "description": "Pizza size in inches: 10, 12, 14, 16, or 18. Required for deals containing pizza."
            },
            "sub_size": {
              "type": "string",
              "description": "'half' for 8 inch or 'whole' for 12 inch. Default: half."
            },
            "sub_fixins": {
              "type": "array",
              "description": "Sub fixins.",
              "items": {
                "type": "string"
              }
            },
            "sub_fixins_3": {
              "type": "array",
              "description": "Fixins for third sub.",
              "items": {
                "type": "string"
              }
            },
            "pizzas": {
              "type": "array",
              "description": "Array of pizzas in the deal. Each pizza has its own toppings. For Double Deal send 2. For 3-Pizza send 3. Include ALL toppings the customer said.",
              "items": {
                "type": "object",
                "properties": {
                  "toppings": {
                    "type": "array",
                    "description": "Toppings for this pizza.",
                    "items": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string",
                          "description": "Topping name."
                        },
                        "half": {
                          "type": "boolean",
                          "description": "True if half pizza only."
                        }
                      }
                    }
                  },
                  "special_instructions": {
                    "type": "string",
                    "description": "Special requests for this pizza."
                  }
                }
              }
            },
            "soda_flavor_2": {
              "type": "string",
              "description": "Soda flavor for second can if combo includes 2."
            },
            "sub_special_instructions_3": {
              "type": "string",
              "description": "Special instructions for third sub."
            },
            "fries_upgrade": {
              "type": "string",
              "description": "If customer wants upgraded fries instead of regular french fries, specify the type. Options: western fries, cheese fries, nacho fries, gravy fries, mozzarella fries, pizza fries, crazy fries, large fries. Costs $2.00 extra. Leave empty for regular french fries."
            },
            "sub_cheese": {
              "type": "string",
              "description": "Cheese for the sub."
            },
            "sub_special_instructions": {
              "type": "string",
              "description": "Special requests for sub like Old Bay."
            },
            "fries_instructions": {
              "type": "string",
              "description": "Special requests for fries (e.g., salt pepper ketchup, old bay, extra crispy). Goes on fries, NOT on the sub."
            },
            "sub_fixins_2": {
              "type": "array",
              "description": "Fixins for second sub.",
              "items": {
                "type": "string"
              }
            },
            "sub_special_instructions_2": {
              "type": "string",
              "description": "Special instructions for second sub."
            },
            "sub_name_3": {
              "type": "string",
              "description": "Third sub name for 3 sub combo."
            },
            "sub_cheese_2": {
              "type": "string",
              "description": "Cheese for second sub."
            },
            "sub_cheese_3": {
              "type": "string",
              "description": "Cheese for third sub."
            },
            "soda_flavor": {
              "type": "string",
              "description": "Soda flavor for first can."
            },
            "sub_name_2": {
              "type": "string",
              "description": "Second sub name for 2/3 sub combo."
            },
            "wing_flavor": {
              "type": "string",
              "description": "Wing flavor."
            }
          }
        }
      }
    ],
    "model_choice": {
      "type": "cascading",
      "model": "gemini-3.0-flash",
      "high_priority": false
    },
    "tool_call_strict_mode": true,
    "default_dynamic_variables": {
      "new_item_price": "0",
      "basket": "[]",
      "new_item_category": "none",
      "suggestion": "none",
      "new_item_name": "none",
      "new_item_id": "0",
      "declined_deals": "[]",
      "deal_match": "none",
      "pricing_id": "none",
      "last_pricing_id": "none"
    },
    "knowledge_base_ids": [],
    "begin_tag_display_position": {
      "x": -2490,
      "y": 510
    }
  }
}
