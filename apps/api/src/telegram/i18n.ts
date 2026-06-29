type Lang = 'en' | 'he';
type Key =
  | 'link_first' | 'linked_ok' | 'help' | 'status_linked' | 'status_unlinked'
  | 'unlinked' | 'photo_unreadable' | 'photo_limit' | 'text_limit'
  | 'no_run' | 'no_workout' | 'habit_done' | 'habit_fail' | 'habit_unclear'
  | 'save_failed' | 'discarded' | 'run_saved' | 'workout_saved' | 'something_wrong'
  | 'code_invalid';

const STRINGS: Record<Key, { en: string; he: string }> = {
  link_first:      { en: 'Link your account first: Pacer → Settings → copy code → send /start <code>.', he: 'קשר/י קודם את החשבון: Pacer → הגדרות → העתק/י קוד → שלח/י start <code>/.' },
  linked_ok:       { en: 'Linked! Send me a run like "ran 5k in 28 min" or a photo of your watch.', he: 'מקושר! שלח/י ריצה כמו "רצתי 5 ק"מ ב-28 דקות" או תמונה של השעון.' },
  help:            { en: 'I log your runs, workouts and habits. Send a run ("5k in 28 min"), a workout ("3x10 squats 60kg"), a habit ("stretched today"), or a watch photo. Commands: /status /unlink', he: 'אני מתעד ריצות, אימונים והרגלים. שלח/י ריצה ("5 ק"מ ב-28 דקות"), אימון ("3x10 סקוואט 60 ק"ג"), הרגל ("מתחתי היום") או תמונת שעון. פקודות: status/ unlink/' },
  status_linked:   { en: '✅ Linked to Pacer.', he: '✅ מחובר ל-Pacer.' },
  status_unlinked: { en: 'Not linked — send /start <code> (get the code in Pacer → Settings).', he: 'לא מחובר — שלח/י start <code>/ (הקוד נמצא ב-Pacer → הגדרות).' },
  unlinked:        { en: 'Unlinked. Send /start <code> to link again.', he: 'נותק. שלח/י start <code>/ כדי לקשר מחדש.' },
  photo_unreadable:{ en: 'I couldn\'t read that clearly — please type the run (e.g. "5k in 28 min").', he: 'לא הצלחתי לקרוא בבירור — כתוב/כתבי את הריצה (למשל "5 ק"מ ב-28 דקות").' },
  photo_limit:     { en: 'You\'ve hit today\'s photo limit (10). Please type the run instead.', he: 'הגעת למגבלת התמונות היומית (10). כתוב/כתבי את הריצה במקום.' },
  text_limit:      { en: 'You\'ve hit today\'s text limit. Try again tomorrow.', he: 'הגעת למגבלת ההודעות היומית. נסה/י שוב מחר.' },
  no_run:          { en: 'I didn\'t catch a run there. Try "ran 5k in 28 minutes".', he: 'לא זיהיתי ריצה. נסה/י "רצתי 5 ק"מ ב-28 דקות".' },
  no_workout:      { en: 'I couldn\'t read that workout — try e.g. "3x10 squats 60kg".', he: 'לא הצלחתי לקרוא את האימון — נסה/י למשל "3x10 סקוואט 60 ק"ג".' },
  habit_done:      { en: 'Marked done today.', he: 'סומן כבוצע היום.' },
  habit_fail:      { en: 'Couldn\'t mark that habit — is it set up in Pacer?', he: 'לא ניתן לסמן את ההרגל — האם הוא מוגדר ב-Pacer?' },
  habit_unclear:   { en: 'I didn\'t catch which habit. Try the habit\'s exact name, e.g. "stretched today".', he: 'לא זיהיתי איזה הרגל. נסה/י את שם ההרגל המדויק, למשל "מתחתי היום".' },
  save_failed:     { en: 'Save failed.', he: 'השמירה נכשלה.' },
  discarded:       { en: 'Discarded — nothing saved.', he: 'בוטל — לא נשמר דבר.' },
  run_saved:       { en: '✅ Run saved to Pacer.', he: '✅ הריצה נשמרה ב-Pacer.' },
  workout_saved:   { en: '✅ Workout saved to Pacer.', he: '✅ האימון נשמר ב-Pacer.' },
  something_wrong: { en: 'Something went wrong reading that — please try again.', he: 'משהו השתבש — נסה/י שוב.' },
  code_invalid:    { en: 'That code is invalid or expired. Generate a fresh one in Pacer → Settings.', he: 'הקוד שגוי או שפג תוקפו. צור/צרי קוד חדש ב-Pacer → הגדרות.' },
};

/** Pick a language from Telegram's language_code (defaults to English). */
export function langOf(code: string | undefined): Lang {
  return code?.toLowerCase().startsWith('he') ? 'he' : 'en';
}

export function t(code: string | undefined, key: Key): string {
  return STRINGS[key][langOf(code)];
}
