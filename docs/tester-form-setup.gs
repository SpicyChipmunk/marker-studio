// Marker Studio: makes the Google Form that Send results and Send feedback post to, and its results sheet.
// 1. Go to https://script.google.com and click New project.
// 2. Delete what's there, paste all of this, and click Save.
// 3. Use a computer (the script editor doesn't run reliably on an iPad). Check the menu beside Run says
//    createMarkerStudioForm, then click Run.
// 4. Google asks for permission: Review permissions › choose the account › if it says "Google hasn't verified this
//    app", click Advanced › Go to (your project) › Allow. It's your own script, so this is expected.
// 5. When it finishes, open Google Drive: there's a new sheet, "Marker Studio beta: results". Its "Setup" tab has the
//    link to send to Claude. (The Execution log at the bottom of the editor shows it too.) Run it only once.

function createMarkerStudioForm() {
  var form = FormApp.create('Marker Studio beta: results and feedback');
  form.setDescription('Filled in by the Marker Studio app. Testers don’t need to open this form.');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);

  // [title, 't' short answer | 'p' paragraph]. The app fills these in; keep the order.
  var fields = [
    ['Kind', 't'],
    ['Tester', 't'],
    ['Name', 't'],
    ['Send', 't'],
    ['Version', 't'],
    ['Device', 't'],
    ['App or tab', 't'],
    ['Markers', 't'],
    ['Use so far', 't'],
    ['1 Add your markers', 't'],
    ['1 Note', 'p'],
    ['2 Make a guide', 't'],
    ['2 Note', 'p'],
    ['3 Make the plan yours', 't'],
    ['3 Note', 'p'],
    ['4 Colour along', 't'],
    ['4 Note', 'p'],
    ['5 Come back to it', 't'],
    ['5 Note', 'p'],
    ['6 Share or print', 't'],
    ['6 Note', 'p'],
    ['Extras', 'p'],
    ['Confused most', 'p'],
    ['Change first', 'p'],
    ['Colours matched', 'p'],
    ['Next page', 't'],
    ['Message', 'p'],
  ];

  var resp = form.createResponse();
  fields.forEach(function (f) {
    var item = (f[1] === 'p' ? form.addParagraphTextItem() : form.addTextItem()).setTitle(f[0]);
    resp.withItemResponse(item.createResponse('x'));
  });

  var ss = SpreadsheetApp.create('Marker Studio beta: results');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // the link, kept in the sheet too, so it can't get lost
  var link = resp.toPrefilledUrl();
  var setup = ss.insertSheet('Setup');
  setup.getRange('A1').setValue('Send this link to Claude:');
  setup.getRange('A2').setValue(link);
  setup.getRange('A4').setValue('The form (testers never need to open it):');
  setup.getRange('A5').setValue(form.getEditUrl());
  console.log('Send this link to Claude: ' + link);
  console.log('Your results sheet: ' + ss.getUrl());
}
