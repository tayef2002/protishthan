-- প্রাথমিক বিদ্যালয়: প্রতিষ্ঠানের নিজের নামে ব্যবস্থাপনা স্পষ্ট লেখা থাকলে সেটা বসানো।
--   নামে "বেসরকারি" / "বেসরকারী" থাকলে  -> বেসরকারি   (সরকারি তালিকায় এমন নাম এখন ০টা, তবু ভুল এড়াতে আগে এটা)
--   নামে "সরকারি" / "সরকারী" / স:প্রা:বি থাকলে (বেসরকারি বাদে) -> সরকারি   (প্রায় ৬৪,৮০০টা)
-- বাকি (প্রায় ৬১০টা, নামে কিছু লেখা নেই) ফাঁকা থাকে। শুধু ফাঁকা ঘর ভরে; কারও হাতে বসানো বা যাচাই করা তথ্য বদলায় না। বারবার চালানো নিরাপদ।
set statement_timeout = '5min';

update public.listing_submissions
   set ownership = 'বেসরকারি'
 where source = 'dpe-primary'
   and coalesce(ownership, '') = ''
   and institution_name ~ '(বেসরকারি|বেসরকারী)';

update public.listing_submissions
   set ownership = 'সরকারি'
 where source = 'dpe-primary'
   and coalesce(ownership, '') = ''
   and institution_name !~ '(বেসরকারি|বেসরকারী)'
   and institution_name ~ '(সরকারি|সরকারী|স:প্রা:বি|সঃ ?প্রাঃ)';
