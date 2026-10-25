'use strict';

// Insertion order is the display order in both the editor and exported reports.
const ratings = {I:'Inspected', NI:'Not Inspected', NP:'Not Present', D:'Deficient'};
const legacyRatings = {NT:'Not tested', OK:'Working as intended', MM:'Minor repair', RR:'Repair or replacement', EV:'Further evaluation', NA:'Not applicable'};

module.exports = {ratings, legacyRatings};
