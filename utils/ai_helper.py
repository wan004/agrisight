import requests
import json
from config import Config

def get_ai_response(message, disease_name='', crop_type='general'):
    """
    Get AI response from OpenRouter (Claude 3.5 Sonnet)
    """
    if not Config.OPENROUTER_API_KEY:
        raise Exception("OpenRouter API key not configured")
    
    # Prepare context for the AI
    context = f"""
    You are an experienced agronomist and plant pathologist. 
    The user is asking about a {crop_type} plant with {disease_name} disease.
    
    Provide helpful, accurate, and safe agricultural advice. Include:
    1. Clear diagnosis explanation
    2. Organic treatment options
    3. Chemical treatment options (if appropriate)
    4. Prevention methods
    5. Safety considerations
    
    Keep responses practical and easy to understand.
    """
    
    headers = {
        'Authorization': f'Bearer {Config.OPENROUTER_API_KEY}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'AgriSight 2.0'
    }
    
    payload = {
        'model': 'anthropic/claude-3.5-sonnet',
        'messages': [
            {
                'role': 'system',
                'content': context
            },
            {
                'role': 'user',
                'content': message
            }
        ],
        'temperature': 0.7,
        'max_tokens': 1000
    }
    
    try:
        response = requests.post(
            Config.OPENROUTER_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            
            if 'choices' in result and result['choices']:
                ai_message = result['choices'][0]['message']['content']

                # OpenRouter Anthropic responses wrap text in a list of segments
                if isinstance(ai_message, list):
                    segments = []
                    for item in ai_message:
                        if isinstance(item, dict):
                            text_value = item.get('text') or ''
                            segments.append(text_value)
                        else:
                            segments.append(str(item))
                    ai_message = ''.join(segments)
                elif isinstance(ai_message, dict):
                    ai_message = ai_message.get('text') or json.dumps(ai_message)

                ai_message = (ai_message or '').strip()

                if not ai_message:
                    raise Exception("Empty response from AI model")

                return ai_message
            else:
                raise Exception("No response from AI model")
        else:
            print(f"OpenRouter API Error: {response.status_code} - {response.text}")
            raise Exception(f"AI API request failed: {response.status_code}")
            
    except requests.exceptions.Timeout:
        raise Exception("AI request timed out - please try again")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error: {e}")
    except Exception as e:
        raise Exception(f"Error getting AI response: {e}")

def get_agricultural_tips(crop_type='general'):
    """
    Get general agricultural tips for a specific crop
    """
    tips_prompt = f"""
    Provide 5 essential agricultural tips for growing {crop_type} successfully.
    Include information about:
    1. Optimal growing conditions
    2. Watering requirements
    3. Common pests and diseases to watch for
    4. Harvest timing
    5. Soil requirements
    
    Keep it concise and practical for farmers.
    """
    
    try:
        return get_ai_response(tips_prompt, '', crop_type)
    except:
        return "Unable to get agricultural tips at this time."

def get_disease_prevention_advice(crop_type='general'):
    """
    Get disease prevention advice for crops
    """
    prevention_prompt = f"""
    Provide comprehensive disease prevention strategies for {crop_type} crops.
    Include:
    1. Cultural practices
    2. Crop rotation suggestions
    3. Sanitation measures
    4. Resistant varieties
    5. Environmental management
    6. Monitoring techniques
    
    Focus on organic and sustainable methods first.
    """
    
    try:
        return get_ai_response(prevention_prompt, '', crop_type)
    except:
        return "Unable to get prevention advice at this time."