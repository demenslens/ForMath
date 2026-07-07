"""Tests voor _block_letter (ast_visualizer).

Kern: een block-ID is `letter + step`, en json_exporter leest het step-nummer
terug als trailing digits (`\\d+$`). De letter mag daarom NOOIT een cijfer
bevatten — ook niet voorbij 26 blokken op één step. De oude fallback `N{i}`
(bijv. `N26`) brak dat: block 26 op step 1 werd "N261" → step las als 261.
"""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'python_bestanden', 'getallen'))

from ast_visualizer import _block_letter


class TestBlockLetter(unittest.TestCase):
    def test_first_26_single_letters(self):
        self.assertEqual(_block_letter(0), 'A')
        self.assertEqual(_block_letter(25), 'Z')

    def test_beyond_26_two_letters(self):
        self.assertEqual(_block_letter(26), 'AA')
        self.assertEqual(_block_letter(27), 'AB')
        self.assertEqual(_block_letter(51), 'AZ')
        self.assertEqual(_block_letter(52), 'BA')

    def test_no_digit_in_letter(self):
        for i in range(200):
            self.assertNotRegex(_block_letter(i), r'\d')

    def test_unique_over_range(self):
        seen = [_block_letter(i) for i in range(200)]
        self.assertEqual(len(seen), len(set(seen)))

    def test_step_recoverable_from_block_id(self):
        # Voorheen brak dit bij i>=26 ("N30" → step las als 30 i.p.v. 7).
        for i in (0, 13, 26, 30, 60):
            bid = f"{_block_letter(i)}7"
            self.assertEqual(re.search(r'(\d+)$', bid).group(1), '7')


if __name__ == '__main__':
    unittest.main()
