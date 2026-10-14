from itertools import permutations,product
from collections import Counter,defaultdict
from math import factorial
from fractions import Fraction
from functools import lru_cache
import json
codes=list(permutations(range(6),3))
def score(a,b):
 exact=sum(x==y for x,y in zip(a,b));return exact,len(set(a)&set(b))-exact
parts=defaultdict(list)
for c in codes:
 if c!=(0,1,2):parts[score(c,(0,1,2))].append(c)
second=[]
for group in parts.values():
 best=max(45000*(g in group)+18000*len({score(c,g) for c in group if c!=g}) for g in codes)
 second.append(best)
cipher=Fraction(180000+sum(second),1200000)
@lru_cache(None)
def comps(n,k=6):
 if k==1:return [(n,)]
 return [(i,)+tail for i in range(n+1) for tail in comps(n-i,k-1)]
def category(c):
 s=sorted(c,reverse=True)
 return 'five' if s[0]==5 else 'four' if s[0]==4 else 'full' if s[:2]==[3,2] else 'three' if s[0]==3 else 'two' if s[:2]==[2,2] else 'none'
weights=lambda c:factorial(sum(c))//__import__('functools').reduce(lambda a,b:a*factorial(b),c,1)
pay={'five':180000,'four':30000,'full':12000,'three':6000,'two':3000,'none':0}
@lru_cache(None)
def expectation(h):
 k=5-sum(h)
 return Fraction(sum(weights(c)*pay[category(tuple(a+b for a,b in zip(h,c)))] for c in comps(k)),6**k)
rtp=Fraction(0);strategy=[]
for c in comps(5):
 holds=product(*(range(n+1) for n in c))
 value,h=max((expectation(h),h) for h in holds)
 rtp+=weights(c)*value/(6**5*10000)
 strategy.append({'counts':c,'hold':h,'bps':float(value)})
report={'cipher':{'returns':[18,4.5,1.8],'optimalReturnFraction':str(cipher),'optimalRTP':float(cipher),'firstFeedbackGroups':len(parts)},'archive':{'payoutBps':pay,'optimalReturnFraction':str(rtp),'optimalRTP':float(rtp)},'passage':{'maxSteps':5,'safeCounts':[3,2],'returnScaleBps':9600,'fixedPolicyRTP':.96,'maxReturn':30.72}}
open('deploy/keeper-games-20261013/math.json','w').write(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
