UPDATE `login_accounts`
SET `name_status`='format_ok',`name_version`=`name_version`+1
WHERE `name_status`='pending' AND `name_flags`='[]'
AND `first_name`!='' AND `last_name`!=''
AND `name_review_note`='';
