export const SAMPLE_SCAM = {
  sender: 'MTN-MoMo',
  body: 'URGENT: Your MoMo account is suspended. Verify now at http://bit.ly/mtn-verify and confirm your PIN within 24 hours.',
};
export const SAMPLE_CAUTION = {
  sender: '+250788000111',
  body: 'Hello, I sent you 20,000 RWF by mistake on MoMo. Please send it back urgently.',
};
export const SAMPLE_SAFE = {
  sender: 'BK',
  body: '482913 is your verification code. Never share this code with anyone.',
};

export const SAFETY_TIPS = [
  { icon: 'link-outline', title: 'Do not tap unexpected links', text: 'Banks and mobile-money providers rarely ask you to log in through an SMS link. Open the official app yourself instead.' },
  { icon: 'key-outline', title: 'Never share codes or PINs', text: 'A one-time code is a key to your account. No genuine agent will ever ask you to read it out or reply with it.' },
  { icon: 'timer-outline', title: 'Pressure is a red flag', text: '"Within 24 hours", "last warning", "act now": scammers rush you so you do not think.' },
  { icon: 'cash-outline', title: '"Sent by mistake" is a classic', text: 'If someone asks you to return money, check your own balance first, and refund only through the official app or by calling the provider.' },
  { icon: 'gift-outline', title: 'You did not win anything', text: 'Prizes you never entered for, and "claim your reward" messages, are lures to steal data or fees.' },
  { icon: 'cube-outline', title: 'Parcel fee? Verify first', text: 'Fake delivery notices ask for small fees to capture card details. Check the courier website directly.' },
  { icon: 'call-outline', title: 'Verify through another channel', text: 'Call the number printed on your card or on the official website. Never use the number inside the SMS.' },
  { icon: 'ban-outline', title: 'Block and report', text: 'Delete the message, block the sender, and report it to your operator (many accept forwards to a short code).' },
] as const;
