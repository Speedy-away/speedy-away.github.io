'use strict';
const questions=[
  {
    "question": "Does a PS4 jailbreak give you free PS Plus?",
    "answer": "No. GoldHEN, HEN / SilverHEN and PhantomHEN are homebrew enablers; they do not create a PlayStation Plus subscription or grant its account benefits. PlayStation Plus is a paid subscription service."
  },
  {
    "question": "Can I play PS4 online multiplayer without PS Plus?",
    "answer": "Most PS4 games require PlayStation Plus for online multiplayer, while some games do not. Check the game’s PlayStation Store requirements. A jailbreak does not by itself establish PSN access or compatibility with a game’s online services."
  },
  {
    "question": "Can PS Plus benefits be shared on a primary PS4?",
    "answer": "An active subscriber can share selected benefits with other users on their primary PS4. This is subscription sharing, not free PS Plus supplied by a jailbreak. Cloud storage and some other benefits cannot be shared."
  },
  {
    "question": "Is PS Plus the same as GoldHEN or PhantomHEN?",
    "answer": "No. PlayStation Plus provides subscription services. GoldHEN, HEN / SilverHEN and PhantomHEN are separate homebrew enablers with their own firmware and loader requirements."
  },
  {
    "question": "Does the local PS4 homebrew host require PS Plus?",
    "answer": "Opening the local browser host or choosing a HEN does not require a PlayStation Plus subscription. Follow the selected host’s setup requirements; individual apps and online services have separate requirements."
  },
  {
    "question": "Which PS4 firmware should I select for this jailbreak?",
    "answer": "Choose the firmware actually installed on your console. This host’s 14.02 exploit and PhantomHEN entry are pinned to PS4 14.02. Use the firmware picker for other versions rather than assuming that a HEN name establishes compatibility."
  }
];
const keywords=[
  "free PS Plus on PS4 jailbreak explained",
  "does PS4 jailbreak give free PS Plus",
  "PS4 jailbreak PS Plus FAQ",
  "PlayStation Plus jailbreak questions",
  "PS Plus sharing primary PS4",
  "jailbroken PS4 online multiplayer requirements",
  "PS4 games without PS Plus requirements",
  "PS4 homebrew without PS Plus",
  "GoldHEN PS Plus questions",
  "PhantomHEN PS Plus questions",
  "PS4 jailbreak beginner guide",
  "PS4 jailbreak firmware compatibility",
  "PS4 offline homebrew setup",
  "GoldHEN vs PhantomHEN"
];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(){return '<section id="ps-plus-faq" aria-labelledby="ps-plus-faq-title"><h2 id="ps-plus-faq-title">PS4 jailbreak, free PS Plus claims &amp; common questions</h2><p>Answers about subscriptions, online multiplayer, primary-console sharing and offline homebrew.</p>'+questions.map(q=>'<article><h3>'+escape(q.question)+'</h3><p>'+escape(q.answer)+'</p></article>').join('')+'<p aria-label="FAQ tags">PS4 jailbreak FAQ · PlayStation Plus · PS Plus sharing · Online multiplayer · Offline homebrew · Firmware compatibility</p><p>Sources: <a href="https://www.playstation.com/en-gb/support/subscriptions/playstation-plus-support/">PlayStation Plus requirements</a> · <a href="https://www.playstation.com/en-gb/support/subscriptions/share-playstation-plus/">Official PS Plus sharing guide</a></p></section>';}
module.exports={questions,keywords,render};
