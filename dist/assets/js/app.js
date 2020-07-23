let currentSelection = {};
let picker;

// Error modal
function showErrorsModal() {
  $("#error").removeClass("hidden");
}

function addErrors(message) {
  $("#errors").append(`<p>${message}</p>`);
  showErrorsModal();
}


// Database Data
let db_locations = [];
let db_homes = [];

function storeDatabaseInformation() {
  let locations = $.getJSON(`./assets/database/locations.json`);
  let homes = $.getJSON(`./assets/database/homes.json`);

  locations.done((data) => {
    db_locations = data;
    updateMapLocations();
    updateSearchResults();
  })
  .fail((data) => {
    addErrors(`<strong>FAILED TO LOAD LOCATIONS DATABASE</strong> (<i>${data.statusText} - ${data.status}</i>)`);    
  });

  homes.done((data) => {
    db_homes = data;
  })
  .fail((data) => {
    addErrors(`<strong>FAILED TO LOAD HOMES DATABASE</strong> (<i>${data.statusText} - ${data.status}</i>)`);    
  });
}
storeDatabaseInformation();


function attemptUpdateList() {
  if(typeof currentSelection.dates != "undefined" & typeof currentSelection.guests != "undefined" & typeof currentSelection.location != "undefined") {
    showFilteredList(currentSelection.dates.checkin, currentSelection.dates.checkout, guests,currentSelection.location);
  }
}



// The date picker
picker = new Litepicker({
  firstDay: 1,
  format: "DD/MM/YYYY",
  numberOfMonths: 2,
  numberOfColumns: 2,
  maxDays: 15,
  autoApply: true,
  showTooltip: false,
  mobileFriendly: true,
  hotelMode: true,
  minDate: new Date().toDateString(),
  singleMode: false,
  element: document.getElementById("datepicker"),
  onSelect: function(date1,date2) { // When user selects the dates
    $("#checkin").text(`${new Date(date1).getDate()}/${new Date(date1).getMonth()}/${new Date(date1).getFullYear()}`);
    $("#checkout").text(`${new Date(date2).getDate()}/${new Date(date2).getMonth()}/${new Date(date2).getFullYear()}`);

    currentSelection.dates = {};
    currentSelection.dates.checkin = new Date(date1).getTime();
    currentSelection.dates.checkout = new Date(date2).getTime();

    attemptUpdateList();
  }
});


// Listeners

// Error modal close button
$("#error-close").on("click", _ => {
  $("#error").addClass("hidden");
});
// When user clicks on datepicker triggers
$(".datepicker-trigger").on("click", _ => {
  picker.show();
});
$("#guests").on("input", function() { // Anon Func used for 'this'
  currentSelection.guests = parseInt($(this).val());
  attemptUpdateList();
});

// MAP
L.mapbox.accessToken = "pk.eyJ1IjoibWlja3lwcmljZSIsImEiOiJja2JsYTQwMnkwMzRmMnNvMjRqa3Q2aHA0In0.nmuuwXz9tsfQYHISE_fRtA";

let mapboxTiles = L.tileLayer("https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=" + L.mapbox.accessToken, {
  attribution: "",
  tileSize: 512,
  zoomOffset: -1
});

let map = L.map("map", { zoomControl: false, minZoom: 4, closePopupOnClick: false})
.addLayer(mapboxTiles)
.setView([-40.900557,174.885971], 15)
.setZoom(6);


let markers = [];

function updateMapLocations() {
  let icon = L.icon({
    iconUrl: "./assets/img/icons/map-marker.png",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, 0]
  });

  let iconActive = L.icon({
    iconUrl: "./assets/img/icons/map-marker-active.png",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, 0]
  });

  for (let i = 0; i < db_locations.length; i++) {
    let marker = L.marker(db_locations[i].location, {icon: icon}).addTo(map);
    marker.name = db_locations[i].name.toUpperCase();
    marker.bindTooltip(db_locations[i].name);
    markers.push(marker);

    marker.on("click", _ => {
      for (let i = 0; i < markers.length; i++) {
        markers[i].setIcon(icon);
      }
      currentSelection.location = db_locations[i];
      marker.setIcon(iconActive);
      attemptUpdateList();
    });
  }

  
}





// Generate Listing HTML
function generateListingHTMLElement(image, name, price, minPeople, maxPeople, minNights, maxNights, id) {
  let difTime = new Date(checkout).getTime() - new Date(checkin).getTime(); 
  let difDays = difTime / (1000 * 3600 * 24) + 1; 
  return `
  <button class="shadow-xl text-left block hover:float-up" onclick="showPopupForHome(${id})">
    <img src="${image}" alt="${name}" class="h-48 w-full object-cover object-center">
    <div class="px-2 py-4 border-b border-gray-500">
      <h3 class="text-md text-gray-700">${name}</h3>
      <p class="text-sm font-medium"><span class="text-2xl">${convertCentsToDollars(price)}</span> / nights</p>
    </div>
    <div class="px-2 py-4 xl:flex">
      <div class="xl:w-1/2 flex items-center flex"><img class="w-8" src="assets/img/icons/user.svg"> <span class="block ml-2 text-xl font-ubuntu font-medium">${minPeople} - ${maxPeople} People</span></div>
      <div class="xl:w-1/2 flex items-center flex mt-4 xl:mt-0"><img class="w-8" src="assets/img/icons/nights.svg"> <span class="block ml-2 text-xl font-ubuntu font-medium">${minNights} - ${maxNights} Nights</span></div>
    </div>
    <div class="px-2 py-4 bg-black text-white text-xl text-center flex justify-center">
      <span>View Property</span>
      <img src="assets/img/icons/chevron-right.svg" alt="chevron right" class="w-6 ml-2">
    </div>
  </button>`;
}

// Show every single listing - usually for debugging purposes
function displayAllListings() { 
  let html = "";
  for (let i = 0; i < db_homes.length; i++) {
    const home = db_homes[i];
    html += generateListingHTMLElement(home.image, home.name, home.price, home.people.min, home.people.max, home.nights.min, home.nights.max, home.id);
  }

  $("#listings").html(html);
  $("#pleaseSelect").remove();
}


function showFilteredList(checkin,checkout,guests,location) { 
  let html = "";
  let showing = [];
  for (let i = 0; i < db_homes.length; i++) {
    const home = db_homes[i];
    let failed = false;

    let difTime = new Date(checkout).getTime() - new Date(checkin).getTime(); 
    let difDays = difTime / (1000 * 3600 * 24) + 1; 
    
    // Check min/max nights
    if(!(difDays >= home.nights.min & difDays <= home.nights.max)) failed = true;
    
    // Check min/max guests
    if(!(currentSelection.guests >= home.people.min & currentSelection.guests <= home.people.max))  failed = true;

    if(home.location !== location.id) failed = true; 

    if (!failed) {
      showing.push(home);
      html += generateListingHTMLElement(home.image, home.name, home.price, home.people.min, home.people.max, home.nights.min, home.nights.max, home.id);
      $("#listing_count").text(`${showing.length} Found`);
      $("#listing_count").show();
    }
  }

  $("#pleaseSelect").remove();
  $("#listings").html(html);
  if(html.length > 0) {
    $("#failedToFindSelection").addClass("hidden");
  } else {
    $("#failedToFindSelection").removeClass("hidden");
  }

}




///////////////////////////////////
// Search for locations on the map
///////////////////////////////////
function updateSearchResults() {
  let substringMatcher = function(strs) {
    return function findMatches(q, cb) {
      let matches, substringRegex;

      // an array that will be populated with substring matches
      matches = [];

      // regex used to determine if a string contains the substring `q`
      substrRegex = new RegExp(q, 'i');

      // iterate through the pool of strings and for any string that
      // contains the substring `q`, add it to the `matches` array
      $.each(strs, function(i, str) {
        if (substrRegex.test(str)) {
          matches.push(str);
        }
      });

      cb(matches);
    };
  };

  let locations = [];
  for (let i = 0; i < db_locations.length; i++) {
    const location = db_locations[i];
    locations.push(location.name);
  }



  $('#map-search input').typeahead({
    hint: true,
    highlight: true,
    minLength: 1,
    classNames: {
      open: 'bg-white w-full shadow-2xl p-4',
      suggestion: 'cursor-pointer mt-2',
      input: 'map-search-input'
    }
  },
  {
    name: 'locations',
    source: substringMatcher(locations)
  });

  $('#map-search input').on('keydown', updateFieldColour);
  $('#map-search input').on('keyup', updateFieldColour);
  $('#map-search input').on('typeahead:select', function() {
    selectLocation($(this)[0].value);
  })

  function updateFieldColour() {
    if ($('.map-search-input').val().length > 0) {
      if ($('.tt-dataset-locations .tt-selectable').length == 0) {
        $('.map-search-input').css({backgroundColor: "#ffc8c8"});
      } else {
        $('.map-search-input').css({backgroundColor: "#FFF"});
        selectLocation($('.map-search-input').val());
      }
    } else {
      $('.map-search-input').css({backgroundColor: "#FFF"});
    }
  }

}

// Select a location on the map
function selectLocation(value) {
  value = value.toUpperCase();
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    if (marker.name.toUpperCase() == value) {
      marker.getElement().click();
      map.flyTo([marker.getLatLng().lat, marker.getLatLng().lng], 10);
    }
  }
}



///////////////////////////////////
//   Property Popups
///////////////////////////////////
function getHome(homeId) {
  for (let i = 0; i < db_homes.length; i++) {
    const home = db_homes[i];
    if(home.id == homeId) {
      return home;
    }
  }
}


// The popup that shows when you click on a property
function showPopupForHome(homeId) {
  let home = getHome(homeId);

  let difTime = new Date(currentSelection.dates.checkout).getTime() - new Date(currentSelection.dates.checkin).getTime(); 
  let difDays = difTime / (1000 * 3600 * 24) + 1; 
  
  let totalPrice = calculateTotalCost(home.price,difDays);

  $('.listing_popup_op_price').text(convertCentsToDollars(home.price));
  $('.listing_popup_op_night_selected').text(difDays);

  $('.listing_popup_op_totalCost').text(totalPrice.dollars);


  $('.listing_popup_op_name').text(home.name);
  $('.listing_popup_op_image').attr('src',home.image);

  $('.listing_popup_op_people').text(home.people.min + " - " + home.people.max + " people");
  $('.listing_popup_op_nights').text(home.nights.min + " - " + home.nights.max + " nights");


  $('#listing_popup').toggleClass('hidden');
  $('body').add('overflow-y-hidden');

  let mealString = "";
  let meals = home.meals.split(',');
  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i];
    mealString+=`<div class="inline-block rounded bg-black text-white p-1 mr-2 text-sm">${meal}</div>`;
  }

  $(".listing_popup_op_meals").html(mealString);

  let location;
  for (let i = 0; i < db_locations.length; i++) {
    if (db_locations[i].id == home.location) {
      location = db_locations[i];
      break;
    }
  }

  $('.listing_popup_op_location').text(location.name);

}

// Calculate a total cost given the price per night & no of nights.
// Returns an object containing dollar value and total in cents.
function calculateTotalCost(pricePerNight, noOfDays) {
  let obj = {}
  obj["cents"] = pricePerNight * noOfDays;
  obj["dollars"] = convertCentsToDollars(pricePerNight * noOfDays);
  return obj;
}

// Convert cents to a dollar string including $ sign
function convertCentsToDollars(cents) {
  return "$" + (cents/100).toFixed(2);
}

// Add listeners for popup map
$(".listing_popup_image_container").on('click', function() {
  $(this).toggleClass('h-48');
  $(this).toggleClass('h-auto');
  $(this).data("open", !$(this).data("open"));
  $(this).find('.listing_popup_image_showfull').text(
    $(this).data("open") ? "Hide Full Image" : "Show Full Image"
  );
});

$('#listing_popup').on('click', function(event) {
  event.stopPropagation();
  if (event.currentTarget == event.target) {
    $(this).addClass('hidden');
    $('body').removeClass('overflow-y-hidden');
  }
});