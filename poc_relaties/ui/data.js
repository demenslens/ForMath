// GEGENEREERD door relatie_manager.py — NIET met de hand bewerken.
// Bron: ../data/*.json + ../data/relaties.json (één gezaghebbende bron).
// Bestaat alleen omdat fetch() van lokale JSON onder file:// geblokkeerd is.
window.POC_DATA = {
 "opgaven": {
  "opgave_20260510_002": {
   "metadata": {
    "id": "opgave_20260510_002",
    "auteur": "H.N.Lensing",
    "expressie": {
     "tekst": "2×(3+4×5)+-(6:2)+7",
     "latex_display": "2\\times\\left(3+4\\cdot5\\right)+-\\left(6:2\\right)+7",
     "mathml": "",
     "ast": {
      "tree": [
       "Add",
       [
        "Multiply",
        2,
        [
         "Add",
         3,
         [
          "Multiply",
          4,
          5
         ]
        ]
       ],
       [
        "Negate",
        [
         "Divide",
         6,
         2
        ]
       ],
       7
      ],
      "node_map": [
       {
        "path": [
         0,
         0
        ],
        "mathblock_id": "A3",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         0,
         1,
         0
        ],
        "mathblock_id": "A2",
        "type": "input",
        "waarde": "3"
       },
       {
        "path": [
         0,
         1,
         1,
         0
        ],
        "mathblock_id": "A1",
        "type": "input",
        "waarde": "4"
       },
       {
        "path": [
         0,
         1,
         1,
         1
        ],
        "mathblock_id": "A1",
        "type": "input",
        "waarde": "5"
       },
       {
        "path": [
         0,
         1,
         1
        ],
        "mathblock_id": "A1",
        "type": "operation"
       },
       {
        "path": [
         0,
         1
        ],
        "mathblock_id": "A2",
        "type": "operation"
       },
       {
        "path": [
         0
        ],
        "mathblock_id": "A3",
        "type": "operation"
       },
       {
        "path": [
         1,
         0,
         0
        ],
        "mathblock_id": "B3",
        "type": "input",
        "waarde": "6"
       },
       {
        "path": [
         1,
         0,
         1
        ],
        "mathblock_id": "B3",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         1,
         0
        ],
        "mathblock_id": "B3",
        "type": "operation"
       },
       {
        "path": [
         2
        ],
        "mathblock_id": "A4",
        "type": "input",
        "waarde": "7"
       },
       {
        "path": [],
        "mathblock_id": "A4",
        "type": "operation"
       }
      ]
     }
    },
    "aantal_mathblocks": 5,
    "bewerkingen": {
     "optelling": 1,
     "vermenigvuldiging": 2,
     "deling": 1,
     "machtsverheffen": 0,
     "worteltrekken": 0,
     "optel_manifold": 1,
     "vermenigvuldig_manifold": 0,
     "matroesjka_manifold": 0,
     "vereenvoudigen": 0,
     "gemengd_getal": 0
    },
    "aantal_steps": 4,
    "niveau": "Hoog",
    "randvoorwaarden": {
     "vereenvoudig_uitkomst": false,
     "antwoord_in_breuken": true,
     "antwoord_in_decimalen": false,
     "decimalen_afronden": 2,
     "pi_decimalen": 2,
     "uitkomst_als_gemengd_getal": true,
     "hints_aan": true,
     "feedback_aan": true
    },
    "opdracht": "reken_uit",
    "soort_opgave": "rekenen_getallen",
    "productie": "enkelvoudig",
    "onderwijstype": "vmbo",
    "onderwijsniveau": "onderbouw",
    "notitie": ""
   },
   "mathblocks": [
    {
     "id": "A1",
     "step": 1,
     "operatie": {
      "symbool": "×",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "4"
      },
      {
       "type": "extern",
       "waarde": "5"
      }
     ],
     "output": "20",
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A2",
     "step": 2,
     "operatie": {
      "symbool": "+",
      "beschrijving": "optelling"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "3"
      },
      {
       "type": "mathblock",
       "id": "A1"
      }
     ],
     "output": "23",
     "hints": {
      "structureel": {
       "wat": "Tel de twee getallen bij elkaar op.",
       "hoe": "Voeg de twee getallen samen tot één som.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A3",
     "step": 3,
     "operatie": {
      "symbool": "×",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "2"
      },
      {
       "type": "mathblock",
       "id": "A2"
      }
     ],
     "output": "46",
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "B3",
     "step": 3,
     "operatie": {
      "symbool": "-(:)",
      "beschrijving": "deling"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "6"
      },
      {
       "type": "extern",
       "waarde": "2"
      }
     ],
     "output": "-3",
     "is_negative": true,
     "hints": {
      "structureel": {
       "wat": "Deel het eerste getal door het tweede.",
       "hoe": "Deel de teller door de noemer.",
       "let_op": "Het minteken vóór deze bewerking werkt op het hele resultaat."
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A4",
     "step": 4,
     "operatie": {
      "symbool": "M+(3)",
      "beschrijving": "optel-manifold",
      "aantal_operanden": 3
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A3"
      },
      {
       "type": "mathblock",
       "id": "B3",
       "is_negative": true
      },
      {
       "type": "extern",
       "waarde": "7"
      }
     ],
     "output": "50",
     "hints": {
      "structureel": {
       "wat": "Tel deze 3 getallen bij elkaar op.",
       "hoe": "De volgorde van optellen is vrij; je mag eerst de getallen groeperen die samen makkelijke uitkomsten geven.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Dit is het goede antwoord op het gevraagde, de opgave is klaar.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    }
   ],
   "externe_inputs": [
    {
     "waarde": "2",
     "mathblock_ids": [
      "A3"
     ]
    },
    {
     "waarde": "3",
     "mathblock_ids": [
      "A2"
     ]
    },
    {
     "waarde": "4",
     "mathblock_ids": [
      "A1"
     ]
    },
    {
     "waarde": "5",
     "mathblock_ids": [
      "A1"
     ]
    },
    {
     "waarde": "6",
     "mathblock_ids": [
      "B3"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "B3"
     ]
    },
    {
     "waarde": "7",
     "mathblock_ids": [
      "A4"
     ]
    }
   ],
   "steps": [
    {
     "step": 1,
     "mathblocks": [
      "A1"
     ]
    },
    {
     "step": 2,
     "mathblocks": [
      "A2"
     ]
    },
    {
     "step": 3,
     "mathblocks": [
      "A3",
      "B3"
     ]
    },
    {
     "step": 4,
     "mathblocks": [
      "A4"
     ]
    }
   ],
   "duo_verzameling": [
    {
     "step": 1,
     "input_expressie": "(2×(3+(4×5)))-(6:2)+7",
     "hoog": [
      {
       "mathblock": "A1",
       "output_expressie": "(2×(3+20))-(6:2)+7"
      }
     ],
     "laag": [
      {
       "mathblock": "B3",
       "output_expressie": "(2×(3+(4×5)))+-3+7"
      }
     ]
    },
    {
     "step": 2,
     "input_expressie": "(2×(3+20))-(6:2)+7",
     "hoog": [
      {
       "mathblock": "A2",
       "output_expressie": "(2×23)-(6:2)+7"
      }
     ],
     "laag": [
      {
       "mathblock": "B3",
       "output_expressie": "(2×(3+20))+-3+7"
      }
     ]
    },
    {
     "step": 3,
     "input_expressie": "(2×23)-(6:2)+7",
     "hoog": [
      {
       "mathblock": "A3",
       "output_expressie": "46-(6:2)+7"
      },
      {
       "mathblock": "B3",
       "output_expressie": "(2×23)+-3+7"
      }
     ],
     "laag": []
    },
    {
     "step": 4,
     "input_expressie": "46+-3+7",
     "hoog": [
      {
       "mathblock": "A4",
       "output_expressie": "50"
      }
     ],
     "laag": []
    }
   ]
  },
  "20260709_001": {
   "metadata": {
    "id": "20260709_001",
    "auteur": "H.N.Lensing",
    "expressie": {
     "tekst": "(-(-2)+sqrt((-2)^2-4×2×(-12)))/(2×2)",
     "latex_display": "\\frac{-\\left(-2\\right)+\\sqrt{\\left(-2\\right)^2-4\\cdot2\\cdot\\left(-12\\right)}}{2\\cdot2}",
     "mathml": "",
     "ast": {
      "tree": [
       "Divide",
       [
        "Add",
        2,
        [
         "Sqrt",
         [
          "Add",
          [
           "Power",
           -2,
           2
          ],
          [
           "Negate",
           [
            "Multiply",
            [
             "Multiply",
             4,
             2
            ],
            -12
           ]
          ]
         ]
        ]
       ],
       [
        "Multiply",
        2,
        2
       ]
      ],
      "node_map": [
       {
        "path": [
         0,
         0
        ],
        "mathblock_id": "A5",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         0
        ],
        "mathblock_id": "A2",
        "type": "input",
        "waarde": "-2"
       },
       {
        "path": [
         0,
         1,
         0,
         0
        ],
        "mathblock_id": "A2",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0,
         1,
         0,
         0,
         0
        ],
        "mathblock_id": "A1",
        "type": "input",
        "waarde": "4"
       },
       {
        "path": [
         0,
         1,
         0,
         1,
         0,
         0,
         1
        ],
        "mathblock_id": "A1",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         0,
         1,
         0,
         1,
         0,
         0
        ],
        "mathblock_id": "A1",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0,
         1,
         0,
         1
        ],
        "mathblock_id": "B2",
        "type": "input",
        "waarde": "-12"
       },
       {
        "path": [
         0,
         1,
         0,
         1,
         0
        ],
        "mathblock_id": "B2",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0
        ],
        "mathblock_id": "A3",
        "type": "operation"
       },
       {
        "path": [
         0,
         1
        ],
        "mathblock_id": "A4",
        "type": "operation"
       },
       {
        "path": [
         0
        ],
        "mathblock_id": "A5",
        "type": "operation"
       },
       {
        "path": [
         1,
         0
        ],
        "mathblock_id": "B5",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         1,
         1
        ],
        "mathblock_id": "B5",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         1
        ],
        "mathblock_id": "B5",
        "type": "operation"
       },
       {
        "path": [],
        "mathblock_id": "A6",
        "type": "operation"
       }
      ]
     }
    },
    "aantal_mathblocks": 8,
    "bewerkingen": {
     "optelling": 2,
     "vermenigvuldiging": 3,
     "deling": 1,
     "machtsverheffen": 1,
     "worteltrekken": 1,
     "optel_manifold": 0,
     "vermenigvuldig_manifold": 0,
     "matroesjka_manifold": 0,
     "vereenvoudigen": 0,
     "gemengd_getal": 0
    },
    "aantal_steps": 6,
    "niveau": "Hoog",
    "randvoorwaarden": {
     "vereenvoudig_uitkomst": false,
     "antwoord_in_breuken": true,
     "antwoord_in_decimalen": false,
     "decimalen_afronden": 2,
     "pi_decimalen": 2,
     "uitkomst_als_gemengd_getal": true,
     "hints_aan": true,
     "feedback_aan": true
    },
    "opdracht": "reken_uit",
    "soort_opgave": "rekenen_getallen",
    "productie": "enkelvoudig",
    "onderwijstype": "havo",
    "onderwijsniveau": "onderbouw",
    "notitie": ""
   },
   "mathblocks": [
    {
     "id": "A1",
     "step": 1,
     "operatie": {
      "symbool": "×",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "4"
      },
      {
       "type": "extern",
       "waarde": "2"
      }
     ],
     "output": "8",
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A2",
     "step": 2,
     "operatie": {
      "symbool": "^2",
      "beschrijving": "machtsverheffen",
      "exponent": 2
     },
     "input": [
      {
       "type": "extern",
       "waarde": "-2"
      }
     ],
     "output": "4",
     "hints": {
      "structureel": {
       "wat": "Verhef het grondtal tot de macht 2.",
       "hoe": "Vermenigvuldig het grondtal 2 keer met zichzelf.",
       "let_op": "Een negatief grondtal met een even exponent geeft een positief resultaat."
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "B2",
     "step": 2,
     "operatie": {
      "symbool": "-(×)",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A1"
      },
      {
       "type": "extern",
       "waarde": "-12"
      }
     ],
     "output": "96",
     "is_negative": true,
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": "Het minteken vóór deze bewerking werkt op het hele resultaat."
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A3",
     "step": 3,
     "operatie": {
      "symbool": "+",
      "beschrijving": "optelling"
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A2"
      },
      {
       "type": "mathblock",
       "id": "B2",
       "is_negative": true
      }
     ],
     "output": "100",
     "hints": {
      "structureel": {
       "wat": "Tel de twee getallen bij elkaar op.",
       "hoe": "Voeg de twee getallen samen tot één som.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A4",
     "step": 4,
     "operatie": {
      "symbool": "√",
      "beschrijving": "worteltrekken",
      "index": 2
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A3"
      }
     ],
     "output": "10",
     "hints": {
      "structureel": {
       "wat": "Trek de vierkantswortel.",
       "hoe": "Zoek het getal dat met zichzelf vermenigvuldigd het radicand geeft.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A5",
     "step": 5,
     "operatie": {
      "symbool": "+",
      "beschrijving": "optelling"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "2"
      },
      {
       "type": "mathblock",
       "id": "A4"
      }
     ],
     "output": "12",
     "hints": {
      "structureel": {
       "wat": "Tel de twee getallen bij elkaar op.",
       "hoe": "Voeg de twee getallen samen tot één som.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "B5",
     "step": 5,
     "operatie": {
      "symbool": "×",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "2"
      },
      {
       "type": "extern",
       "waarde": "2"
      }
     ],
     "output": "4",
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A6",
     "step": 6,
     "operatie": {
      "symbool": ":",
      "beschrijving": "deling"
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A5"
      },
      {
       "type": "mathblock",
       "id": "B5"
      }
     ],
     "output": "3",
     "hints": {
      "structureel": {
       "wat": "Deel het eerste getal door het tweede.",
       "hoe": "Deel de teller door de noemer.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Dit is het goede antwoord op het gevraagde, de opgave is klaar.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    }
   ],
   "externe_inputs": [
    {
     "waarde": "2",
     "mathblock_ids": [
      "A5"
     ]
    },
    {
     "waarde": "-2",
     "mathblock_ids": [
      "A2"
     ]
    },
    {
     "waarde": "4",
     "mathblock_ids": [
      "A1"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "A1"
     ]
    },
    {
     "waarde": "-12",
     "mathblock_ids": [
      "B2"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "B5"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "B5"
     ]
    }
   ],
   "steps": [
    {
     "step": 1,
     "mathblocks": [
      "A1"
     ]
    },
    {
     "step": 2,
     "mathblocks": [
      "A2",
      "B2"
     ]
    },
    {
     "step": 3,
     "mathblocks": [
      "A3"
     ]
    },
    {
     "step": 4,
     "mathblocks": [
      "A4"
     ]
    },
    {
     "step": 5,
     "mathblocks": [
      "A5",
      "B5"
     ]
    },
    {
     "step": 6,
     "mathblocks": [
      "A6"
     ]
    }
   ],
   "duo_verzameling": [
    {
     "step": 1,
     "input_expressie": "(2+√(((-2)^2-((4×2)×-12)))):(2×2)",
     "hoog": [
      {
       "mathblock": "A1",
       "output_expressie": "(2+√(((-2)^2-(8×-12)))):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "A2",
       "output_expressie": "(2+√((4-((4×2)×-12)))):(2×2)"
      },
      {
       "mathblock": "B5",
       "output_expressie": "(2+√(((-2)^2-((4×2)×-12)))):4"
      }
     ]
    },
    {
     "step": 2,
     "input_expressie": "(2+√(((-2)^2-(8×-12)))):(2×2)",
     "hoog": [
      {
       "mathblock": "A2",
       "output_expressie": "(2+√((4-(8×-12)))):(2×2)"
      },
      {
       "mathblock": "B2",
       "output_expressie": "(2+√(((-2)^2+96))):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "B5",
       "output_expressie": "(2+√(((-2)^2-(8×-12)))):4"
      }
     ]
    },
    {
     "step": 3,
     "input_expressie": "(2+√((4+96))):(2×2)",
     "hoog": [
      {
       "mathblock": "A3",
       "output_expressie": "(2+√(100)):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "B5",
       "output_expressie": "(2+√((4+96))):4"
      }
     ]
    },
    {
     "step": 4,
     "input_expressie": "(2+√(100)):(2×2)",
     "hoog": [
      {
       "mathblock": "A4",
       "output_expressie": "(2+10):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "B5",
       "output_expressie": "(2+√(100)):4"
      }
     ]
    },
    {
     "step": 5,
     "input_expressie": "(2+10):(2×2)",
     "hoog": [
      {
       "mathblock": "A5",
       "output_expressie": "12:(2×2)"
      },
      {
       "mathblock": "B5",
       "output_expressie": "(2+10):4"
      }
     ],
     "laag": []
    },
    {
     "step": 6,
     "input_expressie": "12:4",
     "hoog": [
      {
       "mathblock": "A6",
       "output_expressie": "3"
      }
     ],
     "laag": []
    }
   ]
  },
  "20260709_002": {
   "metadata": {
    "id": "20260709_002",
    "auteur": "H.N.Lensing",
    "expressie": {
     "tekst": "(-(-2)-sqrt((-2)^2-4×2×(-12)))/(2×2)",
     "latex_display": "\\frac{-\\left(-2\\right)-\\sqrt{\\left(-2\\right)^2-4\\cdot2\\cdot\\left(-12\\right)}}{2\\cdot2}",
     "mathml": "",
     "ast": {
      "tree": [
       "Divide",
       [
        "Add",
        2,
        [
         "Negate",
         [
          "Sqrt",
          [
           "Add",
           [
            "Power",
            -2,
            2
           ],
           [
            "Negate",
            [
             "Multiply",
             [
              "Multiply",
              4,
              2
             ],
             -12
            ]
           ]
          ]
         ]
        ]
       ],
       [
        "Multiply",
        2,
        2
       ]
      ],
      "node_map": [
       {
        "path": [
         0,
         0
        ],
        "mathblock_id": "A5",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         0,
         0
        ],
        "mathblock_id": "A2",
        "type": "input",
        "waarde": "-2"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         0
        ],
        "mathblock_id": "A2",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         1,
         0,
         0,
         0
        ],
        "mathblock_id": "A1",
        "type": "input",
        "waarde": "4"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         1,
         0,
         0,
         1
        ],
        "mathblock_id": "A1",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         1,
         0,
         0
        ],
        "mathblock_id": "A1",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         1,
         0,
         1
        ],
        "mathblock_id": "B2",
        "type": "input",
        "waarde": "-12"
       },
       {
        "path": [
         0,
         1,
         0,
         0,
         1,
         0
        ],
        "mathblock_id": "B2",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0,
         0
        ],
        "mathblock_id": "A3",
        "type": "operation"
       },
       {
        "path": [
         0,
         1,
         0
        ],
        "mathblock_id": "A4",
        "type": "operation"
       },
       {
        "path": [
         0
        ],
        "mathblock_id": "A5",
        "type": "operation"
       },
       {
        "path": [
         1,
         0
        ],
        "mathblock_id": "B5",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         1,
         1
        ],
        "mathblock_id": "B5",
        "type": "input",
        "waarde": "2"
       },
       {
        "path": [
         1
        ],
        "mathblock_id": "B5",
        "type": "operation"
       },
       {
        "path": [],
        "mathblock_id": "A6",
        "type": "operation"
       }
      ]
     }
    },
    "aantal_mathblocks": 8,
    "bewerkingen": {
     "optelling": 2,
     "vermenigvuldiging": 3,
     "deling": 1,
     "machtsverheffen": 1,
     "worteltrekken": 1,
     "optel_manifold": 0,
     "vermenigvuldig_manifold": 0,
     "matroesjka_manifold": 0,
     "vereenvoudigen": 0,
     "gemengd_getal": 0
    },
    "aantal_steps": 6,
    "niveau": "Hoog",
    "randvoorwaarden": {
     "vereenvoudig_uitkomst": false,
     "antwoord_in_breuken": true,
     "antwoord_in_decimalen": false,
     "decimalen_afronden": 2,
     "pi_decimalen": 2,
     "uitkomst_als_gemengd_getal": true,
     "hints_aan": true,
     "feedback_aan": true
    },
    "opdracht": "reken_uit",
    "soort_opgave": "rekenen_getallen",
    "productie": "enkelvoudig",
    "onderwijstype": "havo",
    "onderwijsniveau": "onderbouw",
    "notitie": ""
   },
   "mathblocks": [
    {
     "id": "A1",
     "step": 1,
     "operatie": {
      "symbool": "×",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "4"
      },
      {
       "type": "extern",
       "waarde": "2"
      }
     ],
     "output": "8",
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A2",
     "step": 2,
     "operatie": {
      "symbool": "^2",
      "beschrijving": "machtsverheffen",
      "exponent": 2
     },
     "input": [
      {
       "type": "extern",
       "waarde": "-2"
      }
     ],
     "output": "4",
     "hints": {
      "structureel": {
       "wat": "Verhef het grondtal tot de macht 2.",
       "hoe": "Vermenigvuldig het grondtal 2 keer met zichzelf.",
       "let_op": "Een negatief grondtal met een even exponent geeft een positief resultaat."
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "B2",
     "step": 2,
     "operatie": {
      "symbool": "-(×)",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A1"
      },
      {
       "type": "extern",
       "waarde": "-12"
      }
     ],
     "output": "96",
     "is_negative": true,
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": "Het minteken vóór deze bewerking werkt op het hele resultaat."
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A3",
     "step": 3,
     "operatie": {
      "symbool": "+",
      "beschrijving": "optelling"
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A2"
      },
      {
       "type": "mathblock",
       "id": "B2",
       "is_negative": true
      }
     ],
     "output": "100",
     "hints": {
      "structureel": {
       "wat": "Tel de twee getallen bij elkaar op.",
       "hoe": "Voeg de twee getallen samen tot één som.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A4",
     "step": 4,
     "operatie": {
      "symbool": "-(√)",
      "beschrijving": "worteltrekken",
      "index": 2
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A3"
      }
     ],
     "output": "-10",
     "is_negative": true,
     "hints": {
      "structureel": {
       "wat": "Trek de vierkantswortel.",
       "hoe": "Zoek het getal dat met zichzelf vermenigvuldigd het radicand geeft.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A5",
     "step": 5,
     "operatie": {
      "symbool": "+",
      "beschrijving": "optelling"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "2"
      },
      {
       "type": "mathblock",
       "id": "A4",
       "is_negative": true
      }
     ],
     "output": "-8",
     "hints": {
      "structureel": {
       "wat": "Tel de twee getallen bij elkaar op.",
       "hoe": "Voeg de twee getallen samen tot één som.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "B5",
     "step": 5,
     "operatie": {
      "symbool": "×",
      "beschrijving": "vermenigvuldiging"
     },
     "input": [
      {
       "type": "extern",
       "waarde": "2"
      },
      {
       "type": "extern",
       "waarde": "2"
      }
     ],
     "output": "4",
     "hints": {
      "structureel": {
       "wat": "Vermenigvuldig de twee getallen met elkaar.",
       "hoe": "Bereken het product van de twee factoren.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Correct, ga door met de volgende bewerking.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    },
    {
     "id": "A6",
     "step": 6,
     "operatie": {
      "symbool": ":",
      "beschrijving": "deling"
     },
     "input": [
      {
       "type": "mathblock",
       "id": "A5"
      },
      {
       "type": "mathblock",
       "id": "B5"
      }
     ],
     "output": "-2",
     "hints": {
      "structureel": {
       "wat": "Deel het eerste getal door het tweede.",
       "hoe": "Deel de teller door de noemer.",
       "let_op": ""
      },
      "feedback": {
       "bij_correct": "Dit is het goede antwoord op het gevraagde, de opgave is klaar.",
       "bij_fout_algemeen": "Klopt nog niet. Controleer je berekening en probeer het opnieuw.",
       "veelvoorkomende_fouten": []
      },
      "didactisch": {
       "didactische_uitleg": "",
       "voorbeeld": "",
       "verwijzing_lesstof": ""
      }
     }
    }
   ],
   "externe_inputs": [
    {
     "waarde": "2",
     "mathblock_ids": [
      "A5"
     ]
    },
    {
     "waarde": "-2",
     "mathblock_ids": [
      "A2"
     ]
    },
    {
     "waarde": "4",
     "mathblock_ids": [
      "A1"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "A1"
     ]
    },
    {
     "waarde": "-12",
     "mathblock_ids": [
      "B2"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "B5"
     ]
    },
    {
     "waarde": "2",
     "mathblock_ids": [
      "B5"
     ]
    }
   ],
   "steps": [
    {
     "step": 1,
     "mathblocks": [
      "A1"
     ]
    },
    {
     "step": 2,
     "mathblocks": [
      "A2",
      "B2"
     ]
    },
    {
     "step": 3,
     "mathblocks": [
      "A3"
     ]
    },
    {
     "step": 4,
     "mathblocks": [
      "A4"
     ]
    },
    {
     "step": 5,
     "mathblocks": [
      "A5",
      "B5"
     ]
    },
    {
     "step": 6,
     "mathblocks": [
      "A6"
     ]
    }
   ],
   "duo_verzameling": [
    {
     "step": 1,
     "input_expressie": "(2-(√(((-2)^2-((4×2)×-12))))):(2×2)",
     "hoog": [
      {
       "mathblock": "A1",
       "output_expressie": "(2-(√(((-2)^2-(8×-12))))):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "A2",
       "output_expressie": "(2-(√((4-((4×2)×-12))))):(2×2)"
      },
      {
       "mathblock": "B5",
       "output_expressie": "(2-(√(((-2)^2-((4×2)×-12))))):4"
      }
     ]
    },
    {
     "step": 2,
     "input_expressie": "(2-(√(((-2)^2-(8×-12))))):(2×2)",
     "hoog": [
      {
       "mathblock": "A2",
       "output_expressie": "(2-(√((4-(8×-12))))):(2×2)"
      },
      {
       "mathblock": "B2",
       "output_expressie": "(2-(√(((-2)^2+96)))):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "B5",
       "output_expressie": "(2-(√(((-2)^2-(8×-12))))):4"
      }
     ]
    },
    {
     "step": 3,
     "input_expressie": "(2-(√((4+96)))):(2×2)",
     "hoog": [
      {
       "mathblock": "A3",
       "output_expressie": "(2-(√(100))):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "B5",
       "output_expressie": "(2-(√((4+96)))):4"
      }
     ]
    },
    {
     "step": 4,
     "input_expressie": "(2-(√(100))):(2×2)",
     "hoog": [
      {
       "mathblock": "A4",
       "output_expressie": "(2+-10):(2×2)"
      }
     ],
     "laag": [
      {
       "mathblock": "B5",
       "output_expressie": "(2-(√(100))):4"
      }
     ]
    },
    {
     "step": 5,
     "input_expressie": "(2+-10):(2×2)",
     "hoog": [
      {
       "mathblock": "A5",
       "output_expressie": "-8:(2×2)"
      },
      {
       "mathblock": "B5",
       "output_expressie": "(2+-10):4"
      }
     ],
     "laag": []
    },
    {
     "step": 6,
     "input_expressie": "-8:4",
     "hoog": [
      {
       "mathblock": "A6",
       "output_expressie": "-2"
      }
     ],
     "laag": []
    }
   ]
  }
 },
 "relaties": {
  "schema_versie": 1,
  "relaties": [
   {
    "relatie_id": "abc_709",
    "type": "vertakking",
    "beschrijving": "Twee wortels via de abc-formule: x = (-(-2) ± √((-2)² - 4·2·(-12))) / (2·2). Gedeelde afleiding t/m de discriminant D = 100 (mathblock A3), daarna splitst ± in de +wortel (x₁ = 3) en de -wortel (x₂ = -2).",
    "leden": [
     {
      "opgave": "20260709_001",
      "rol": "+wortel"
     },
     {
      "opgave": "20260709_002",
      "rol": "-wortel"
     }
    ],
    "gedeelde_prefix": {
     "t_m_mathblock": "A3",
     "mathblocks": [
      "A1",
      "A2",
      "B2",
      "A3"
     ],
     "fork_step": 3,
     "vingerafdruk": "sha256:dc401153e70d"
    },
    "gelijke_uitkomst": false
   }
  ]
 }
};
