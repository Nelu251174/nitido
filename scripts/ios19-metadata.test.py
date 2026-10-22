import importlib.util,unittest,tempfile,pathlib
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('release',pathlib.Path(__file__).with_name('ios19-release-control.py'));r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class Metadata(unittest.TestCase):
 def scenario(self,*,existing=False,state='PREPARE_FOR_SUBMISSION'):
  calls=[];old={'id':'approved','attributes':{'versionString':'1.0.1','platform':'IOS','appStoreState':'READY_FOR_SALE','copyright':'Owner approved copyright'}};new={'id':'update','attributes':{'versionString':'1.0.2','platform':'IOS','appStoreState':state,'copyright':'Owner approved copyright'}}
  def rows(path):
   if '/appStoreVersions?' in path:return [old,new] if existing else [old]
   if path.startswith('/v1/apps?'):return [{'id':r.APP,'attributes':{'bundleId':r.BUNDLE}}]
   if 'approved/appStoreVersionLocalizations' in path:return [{'id':'old-ro','attributes':{'locale':'ro','description':'Approved description','supportUrl':'https://nitido.ro/contact'}}]
   if 'update/appStoreVersionLocalizations' in path:return [{'id':'new-ro','attributes':{'locale':'ro','description':'Owner draft description','supportUrl':'https://nitido.ro/contact','whatsNew':'Owner release text'}}]
   if '/appScreenshotSets?' in path:return [{'id':'large','attributes':{'screenshotDisplayType':'APP_IPHONE_67'}}]
   raise AssertionError(path)
  details={'contactFirstName':'Synthetic','contactLastName':'Reviewer','contactEmail':'test@example.test','contactPhone':'+40000000000','demoAccountRequired':True,'demoAccountName':'review@example.test','demoAccountPassword':'synthetic-fixture','notes':'Existing instructions'}
  def apple(path,method='GET',data=None):
   calls.append((path,method,data))
   if path=='/v1/appStoreVersions' and method=='POST':return {'data':new}
   if path.endswith('approved/appStoreReviewDetail'):return {'data':{'id':'approved-detail','attributes':details}}
   if path.endswith('update/appStoreReviewDetail'):return {'data':{'id':'new-detail','attributes':details}}
   if method=='PATCH':return {'data':data['data']}
   raise AssertionError((path,method))
  return calls,rows,apple
 def run_case(self,**kwargs):
  calls,rows,apple=self.scenario(**kwargs)
  with tempfile.TemporaryDirectory() as folder,patch.object(r,'rows',side_effect=rows),patch.object(r,'apple',side_effect=apple),patch.dict(r.os.environ,{'RUNNER_TEMP':folder}):r.prepare()
  return calls
 def test_only_creates_expected_update_and_never_changes_approved_version(self):
  calls=self.run_case();creation=next(x for x in calls if x[1]=='POST');self.assertEqual(creation[2]['data']['attributes']['versionString'],'1.0.2');self.assertTrue(all('approved' not in path for path,method,_ in calls if method!='GET'));self.assertTrue(any(path.endswith('new-detail') for path,method,_ in calls if method=='PATCH'))
 def test_preserves_existing_owner_draft_text_and_review_credentials(self):
  calls=self.run_case(existing=True);self.assertFalse(any(method=='POST' for _,method,_ in calls));self.assertFalse(any(method=='PATCH' for _,method,_ in calls))
 def test_never_edits_an_update_already_under_review(self):
  calls,rows,apple=self.scenario(existing=True,state='WAITING_FOR_REVIEW')
  with patch.object(r,'rows',side_effect=rows),patch.object(r,'apple',side_effect=apple),self.assertRaisesRegex(ValueError,'Preserve'):r.prepare()
  self.assertFalse(any(method!='GET' for _,method,_ in calls))
if __name__=='__main__':unittest.main()
