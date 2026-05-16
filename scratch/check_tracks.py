import requests
import json

def check_group_tracks():
    try:
        r = requests.get("https://statslc.leosaquetto.com/api/group")
        data = r.json()
        if 'members' in data and len(data['members']) > 0:
            for member in data['members']:
                if 'tops' in member and 'tracks' in member['tops'] and len(member['tops']['tracks']) > 0:
                    print(f"--- Estrutura de Track para usuário {member.get('key')} ---")
                    print(json.dumps(member['tops']['tracks'][0], indent=2))
                    return
            print("Nenhuma track encontrada nos membros.")
        else:
            print("Nenhum membro encontrado.")
    except Exception as e:
        print(f"Erro: {e}")

check_group_tracks()
