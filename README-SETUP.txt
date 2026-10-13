גרסה 2 — התראות Push ללימודים
================================
זהו קוד מוכן להגדרה, לא מערכת התראות שכבר פעילה. אין לשתף מפתחות פרטיים או SERVICE_ROLE עם אנשים אחרים.

1. צור פרויקט חינמי ב-Supabase. הפעל Anonymous Sign-ins תחת Authentication > Providers > Anonymous.
2. פתח SQL Editor והרץ את schema.sql. בדוק שמדיניות RLS מופעלת.
3. הפק זוג מפתחות VAPID עם `npx web-push generate-vapid-keys` במחשב (דורש Node.js).
4. ב-Netlify, הוסף Environment variables הבאים:
   SUPABASE_URL = Project URL
   SUPABASE_ANON_KEY = publishable/anon key
   SUPABASE_SERVICE_ROLE_KEY = secret service_role key (לעולם לא בקוד הדפדפן)
   VAPID_PUBLIC_KEY = public key
   VAPID_PRIVATE_KEY = private key
   VAPID_SUBJECT = mailto:your-email@example.com (החלף בכתובת שלך)
5. חבר את תיקיית הפרויקט לריפו Git ופרוס באמצעות Netlify Git deploy, או פרוס באמצעות Netlify CLI עם build/functions. גרירת ZIP ב-Netlify Drop אינה מספיקה לפריסת Scheduled Functions.
6. באייפון: פתח את האתר ב-Safari, שיתוף > הוסף למסך הבית. פתח דרך האייקון, לחץ "הפעלת התראות" ואשר הרשאות.
7. בדוק תחילה את "בדיקת התראה במכשיר" (בודק הרשאה בלבד). לבדיקת שרת נדרשת הרצה/לוגים ב-Netlify.

הסימונים הקיימים נשמרים ב-localStorage תחת המפתח haifa-study-checklist-v1; בעת התחברות ראשונה לענן האפליקציה מעלה סימונים מקומיים שלא קיימים עדיין בענן. באייפון אפליקציית מסך הבית עשויה להשתמש באחסון נפרד מ-Safari. ניתן להעביר סימונים עם ייצוא/ייבוא גיבוי.

השרת בודק מדי שעה, אך שולח רק כאשר השעה המקומית בישראל 10:00 (כולל שעון קיץ/חורף). בימים ראשון עד חמישי בודק את יום המחרת; ביום שישי בודק את ראשון; בשבת שולח סיכום שבוע שמסתיים. רק שבוע יעד נוכחי רלוונטי. התראות לא נשלחות על שבועות ישנים.

חשוב: שליחת Push אינה מובטחת בשנייה מדויקת (תלוי בספקים ובמערכת ההפעלה). אין סנכרון בין מכשירים שונים כי כל מכשיר יוצר משתמש אנונימי נפרד. כדי לסנכרן בין מכשירים, יש להוסיף התחברות משתמש רגילה.
